from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, BigInteger, DateTime, Float
import requests
import datetime
import api_config
import rds_config
import logging
logging.basicConfig(filename='forecast.log', format='%(asctime)s   %(levelname)s   %(message)s', level=logging.INFO)

import datetime as dt
 
try:
    engine=create_engine("mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST, rds_config.DBPORT, rds_config.DBNAME), echo=True)
except:
    logging.error('forecast.py - create_engine')
    
meta = MetaData()

hourly = Table(
    'hourly', meta, 
    Column('dt', DateTime, primary_key=True),
    Column('future_dt', DateTime, primary_key=True),
    Column('temp', Float),
    Column('feels_like', Float),
    Column('pressure', Integer),
    Column('humidity', Integer),
    Column('dew_point', Float),
    Column('uvi', Float),
    Column('clouds', Integer),
    Column('visibility', Integer),
    Column('wind_speed', Float),
    Column('wind_deg', Integer),
    Column('wind_gust', Integer),
    Column('weather_id', Integer),
    Column('weather_main', String(128)),
    Column('weather_description', String(128)),
    Column('weather_icon', String(128)),
    Column('pop', Float)
)

daily = Table(
    'daily', meta, 
    Column('dt', DateTime, primary_key=True),
    Column('future_dt', DateTime, primary_key=True),
    Column('temp_day', Float),
    Column('temp_min', Float),
    Column('temp_max', Float),
    Column('temp_night', Float),
    Column('temp_eve', Float),
    Column('temp_morn', Float),
    Column('feels_like_day', Float),
    Column('feels_like_night', Float),
    Column('feels_like_eve', Float),
    Column('feels_like_morn', Float),
    Column('pressure', Integer),
    Column('humidity', Integer),
    Column('dew_point', Float),
    Column('wind_speed', Float),
    Column('wind_deg', Integer),
    Column('weather_id', Integer),
    Column('weather_main', String(128)),
    Column('weather_description', String(128)),
    Column('weather_icon', String(128)),
    Column('clouds', Integer),
    Column('pop', Float),
    Column('uvi', Float)
)


try:
    meta.create_all(engine, checkfirst=True)
except:
    logging.error('forecast.py - create_all')
    
    
def get_hourly(h, curr_dt):
    return {'dt': curr_dt,
            'future_dt': dt.datetime.fromtimestamp(int(h['dt'])),
            'temp': h['temp'],
            'feels_like': h['feels_like'],
            'pressure': h['pressure'],
            'humidity': h['humidity'],
            'dew_point': h['dew_point'],
            'uvi': h['uvi'], 
            'clouds': h['clouds'],
            'visibility': h['visibility'],
            'wind_speed': h['wind_speed'],
            'wind_deg': h['wind_deg'],
            'wind_gust': h['wind_gust'],
            'weather_id': h['weather'][0]['id'],      # weather: [{}]
            'weather_main': h['weather'][0]['main'],
            'weather_description': h['weather'][0]['description'],
            'weather_icon': h['weather'][0]['icon'],
            'pop': h['pop']     
           }

def get_daily(d, curr_dt):
    return {'dt': curr_dt,
            'future_dt': dt.datetime.fromtimestamp(int(d['dt'])),
            'temp_day': d['temp']['day'], # temp: {}
            'temp_min': d['temp']['min'],
            'temp_max': d['temp']['max'],
            'temp_night': d['temp']['night'],
            'temp_eve': d['temp']['eve'],
            'temp_morn': d['temp']['morn'],          
            'feels_like_day': d['feels_like']['day'], # feels_like: {}
            'feels_like_night': d['feels_like']['night'],
            'feels_like_eve': d['feels_like']['eve'],
            'feels_like_morn': d['feels_like']['morn'],           
            'pressure': d['pressure'],
            'humidity': d['humidity'],
            'dew_point': d['dew_point'],
            'wind_speed': d['wind_speed'],
            'wind_deg': d['wind_deg'],
            'weather_id': d['weather'][0]['id'],
            'weather_main': d['weather'][0]['main'],
            'weather_description': d['weather'][0]['description'], 
            'weather_icon': d['weather'][0]['icon'],
            'clouds': d['clouds'],
            'pop': d['pop'],
            'uvi': d['uvi']
           }
  
def write_to_db(table_name, values):
    metadata = MetaData()
    metadata.reflect(bind=engine)
    table = metadata.tables.get(table_name)

    with engine.connect() as connection:
        for val in values:
            try:
                res = connection.execute(table.insert().values(val))
            except:
                logging.error('forecast.py - execute()')
    return

try:
    r = requests.get(api_config.OP_URI_ONECALL, params={'lat': 53.344, 'lon': -6.2672, 'exclude': 'minutely,alerts', "appid": api_config.OP_APIKEY})
    weather = r.json()
    curr_dt = dt.datetime.fromtimestamp(int(weather.get('current').get('dt')))
    write_to_db('hourly',  [get_hourly(h, curr_dt) for h in weather.get('hourly')])
    write_to_db('daily', [get_daily(d, curr_dt) for d in weather.get('daily')])
except:
    logging.error('forecast.py - requests()')