from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, BigInteger, DateTime
import requests
import datetime
import api_config
import rds_config
import logging
logging.basicConfig(filename='harvester.log', format='%(asctime)s   %(levelname)s   %(message)s', level=logging.INFO)


logging.info('Started - harvester.py')

try:
    engine=create_engine("mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST, rds_config.DBPORT, rds_config.DBNAME), echo=True)
except:
    logging.error('create_engine')
    # quit()

meta = MetaData()

# snapshot 
station = Table(
   'station', meta,
   Column('last_update', BigInteger),
   Column('number', Integer, primary_key = True),
   Column('name', String(128)),
   Column('address', String(128)),
   Column('pos_lat', String(128)),
   Column('pos_lng', String(128)),
   Column('bike_stands', Integer),
   Column('available_bike_stands', Integer),
   Column('available_bikes', Integer),
   Column('status', String(128))
)

availability = Table(
    'availability', meta,
    Column('number', Integer, primary_key = True),
    Column('bike_stands', Integer),
    Column('available_bike_stands', Integer),
    Column('available_bikes', Integer),
    Column('status', String(128)),
    Column('last_update', BigInteger, primary_key = True)
)

try:
    meta.create_all(engine, checkfirst=True)
    logging.info('   create_all')
except:
    logging.error('  create_all')
    # quit()



def get_availability(obj):
    return {'number': obj['number'],
            'bike_stands': obj['bike_stands'],
            'available_bike_stands': obj['available_bike_stands'],
            'available_bikes': obj['available_bikes'],
            'status': obj['status'],
            'last_update': obj['last_update']
    }

def get_station(obj):
    return {'last_update': obj['last_update'],
            'number': obj['number'],
            'name': obj['name'],
            'address': obj['address'],
            'pos_lng': obj['position']['lng'],
            'pos_lat': obj['position']['lat'],
            'bike_stands': obj['bike_stands'],
            'available_bike_stands': obj['available_bike_stands'],
            'available_bikes': obj['available_bikes'],
            'status': obj['status']
    }

try:
    r = requests.get(api_config.JC_STATIONS_URI, params={"apiKey": api_config.JC_APIKEY,"contract": api_config.JC_CONTRACT})
except:
    logging.error('requests.get')
    # quit()

try:
    avail_values = list(map(get_availability, r.json()))
    # "INSERT IGNORE INTO <table> VALUES ...", IntegrityError, Duplicate entry
    avail_ins = availability.insert().values(avail_values).prefix_with('IGNORE')
    engine.execute(avail_ins)
except:
    logging.error('Inserting values - availability')

try:
    sql = "DELETE FROM dublinbikes.station"
    engine.execute(sql)

    station_values = list(map(get_station, r.json()))
    station_ins = station.insert().values(station_values).prefix_with('IGNORE')
    engine.execute(station_ins)
except:
    logging.error('Inserting values - station')


logging.info('Finished - harvester.py')
