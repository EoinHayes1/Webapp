from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, BigInteger, DateTime, Float
import requests
import datetime
import api_config
import rds_config
import logging
logging.basicConfig(filename='weather.log', format='%(asctime)s   %(levelname)s   %(message)s', level=logging.INFO)


logging.info('Started - weather.py')

# 1. connect to db
try:
    engine=create_engine("mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST, rds_config.DBPORT, rds_config.DBNAME), echo=True)
except:
    logging.error('create_engine')
    # quit()

# 2. create tables if don't already exist
meta = MetaData()

weather = Table(
    'weather', meta,
    Column('coord_lon', Float(3,4)),#negative floats?
    Column('coord_lat', Float(3,4)),
    Column('weather_id', Integer),
    Column('weather_main', String(128)),
    Column('weather_description', String(128)),
    Column('weather_icon', String(128)),
    Column('base', String(128)),
    Column('main_temp', Float(3,2)),
    Column('main_feels_like', Float(3,2)),
    Column('main_temp_min', Float(3,2)),
    Column('main_temp_max', Float(3,2)),
    Column('main_pressure', Integer),
    Column('main_humidity', Integer),
    Column('visibility', Integer),
    Column('wind_speed', Float(3,2)),
    Column('wind_deg', Integer),
    Column('clouds_all', Integer),
    Column('dt', DateTime, primary_key = True),
    Column('sys_type', Integer),
    Column('sys_id', Integer),
    Column('sys_country', String(128)),
    Column('sys_sunrise', DateTime),
    Column('sys_sunset', DateTime),
    Column('timezone', Integer),
    Column('id', Integer, primary_key = True), # dublin ID
    Column('name', String(128)),
    Column('cod', Integer)
)

try:
    meta.create_all(engine, checkfirst=True)
except:
    logging.error('create_all')
    #quit()


# 3. OpenWeather API
def get_weather(obj):
    return {'coord_lon': obj['coord']['lon'],
            'coord_lat': obj['coord']['lat'],
            'weather_id': obj['weather'][0]['id'],
            'weather_main': obj['weather'][0]['main'],
            'weather_description': obj['weather'][0]['description'],
            'weather_icon': obj['weather'][0]['icon'],
            'base': obj['base'],
            'main_temp': obj['main']['temp'],
            'main_feels_like': obj['main']['feels_like'],
            'main_temp_min': obj['main']['temp_min'],
            'main_temp_max': obj['main']['temp_max'],
            'main_pressure': obj['main']['pressure'],
            'main_humidity': obj['main']['humidity'],
            'visibility': obj['visibility'],
            'wind_speed': obj['wind']['speed'],
            'wind_deg': obj['wind']['deg'],
            'clouds_all': obj['clouds']['all'],
            'dt': datetime.datetime.fromtimestamp(int(obj['dt'])),
            'sys_type': obj['sys']['type'],
            'sys_id': obj['sys']['id'],
            'sys_country': obj['sys']['country'],
            'sys_sunrise': datetime.datetime.fromtimestamp(int(obj['sys']['sunrise'])),
            'sys_sunset': datetime.datetime.fromtimestamp(int(obj['sys']['sunset'])),
            'timezone': obj['timezone'],
            'id': obj['id'],
            'name': obj['name'],
            'cod': obj['cod']
    }

try:
    r = requests.get(api_config.OP_URI, params={"id": api_config.OP_CITYID, "appid": api_config.OP_APIKEY})
except:
    logging.error('requests.get')
    # quit()

print('got this far')

# 4. save data to db
try:
    weather_values = list(map(get_weather, [r.json()]))  # put single dict into [] to make into a list
    weather_ins = weather.insert().values(weather_values).prefix_with('IGNORE')
    engine.execute(weather_ins)
except Exception as e:
    print(e) # unsupported operand type(s) for /: 'NoneType' and 'float'
    logging.error('Inserting values - weather')



logging.info('Finished - weather.py')
