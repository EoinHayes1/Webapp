from flask import Flask, render_template, jsonify
from sqlalchemy import create_engine
from functools import lru_cache
import rds_config
import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from joblib import dump, load
import numpy as np
from datetime import datetime


app = Flask(__name__)

@app.route('/')
def root():
    return render_template("index.html")

@app.route("/stations")
#@lru_cache()
def stations():
    engine = create_engine(
        "mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST,
                                                rds_config.DBPORT, rds_config.DBNAME), echo=True)
    sql = "SELECT * FROM dublinbikes.station"
    df = pd.read_sql_query(sql, engine)
    return df.to_json(orient='records')


@app.route("/weather")
#@lru_cache()
def weather():
    engine = create_engine(
        "mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST,
                                                rds_config.DBPORT, rds_config.DBNAME), echo=True)
    sql = "SELECT  * FROM dublinbikes.weather WHERE dt = (SELECT MAX(dt) FROM dublinbikes.weather)"
    df = pd.read_sql_query(sql, engine)
    return df.to_json(orient='records')


@app.route("/hourly/<date_selected>")
#@lru_cache()
def get_hourly(date_selected):
    engine = create_engine(
        "mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST,
                                                rds_config.DBPORT, rds_config.DBNAME), echo=True)
    # select the most recent prediction (dt) for the future_dt that's closest in past to dateSelected
    sql = f"SELECT * from dublinbikes.hourly WHERE future_dt <= {date_selected} ORDER  BY future_dt DESC, dt DESC LIMIT  1;"
    df = pd.read_sql_query(sql, engine)
    return df.to_json(orient='records')


@app.route("/daily/<date_selected>")
#@lru_cache()
def get_daily(date_selected):
    engine = create_engine(
        "mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST,
                                                rds_config.DBPORT, rds_config.DBNAME), echo=True)
    sql = f"SELECT * from dublinbikes.daily WHERE DATE(future_dt) = DATE({date_selected}) ORDER  BY dt DESC LIMIT  1;"
    df = pd.read_sql_query(sql, engine)
    return df.to_json(orient='records')


@app.route("/predict/<int:station_number>/<int:day>/<int:hour>/<weather_main>/<float:temp>/<float:wind_speed>")
#@lru_cache()
def predict(station_number, day, hour, weather_main, temp, wind_speed):
    # categorical -> continuous
    if weather_main in ["Clouds", "Mist"]:
        weather_main_con = 0
    elif weather_main == "Drizzle":
        weather_main_con = 1
    elif weather_main == "Rain":
        weather_main_con = 2
    else:
        weather_main_con = 3  # anything  else "Clear"

    # arr = ["station_number", "day", "hour", 'weather_main', 'temp', 'wind_speed']
    args = []
    args.append([station_number, day, hour, weather_main_con, temp, wind_speed])
    rfr1 = load('models/available_bikes_station_' + str(station_number) + '.joblib')
    res1 = rfr1.predict(args)
    rfr2 = load('models/available_bike_stands_station_' + str(station_number) + '.joblib')
    res2 = rfr2.predict(args)
    return jsonify(available_bikes=int(res1),
                   available_bike_stands=int(res2))  # int() or else -> TypeError: Object of type 'ndarray' is not JSON serializable


@app.route("/occupancy/<int:station_id>")
#@lru_cache()
def get_occupancy(station_id):
    engine = create_engine(
        "mysql+pymysql://{}:{}@{}:{}/{}".format(rds_config.USERNAME, rds_config.PSSWRD, rds_config.HOST,
                                                rds_config.DBPORT, rds_config.DBNAME), echo=True)
    sql = f"""SELECT availability.number, availability.available_bike_stands, 
    availability.available_bikes, weather.weather_description, 
    from_unixtime(round(unix_timestamp(from_unixtime(availability.last_update/1000))/(60*15))*(60*15)) as test1 
    FROM dublinbikes.availability, dublinbikes.weather 
    where from_unixtime(round(unix_timestamp(from_unixtime(availability.last_update/1000))/(60*15))*(60*15))
    = from_unixtime(round(unix_timestamp(weather.dt)/(60*15))*(60*15))
    and availability.number = {station_id}
    AND availability.last_update > '2021-02-01' 
    group by test1
    order by availability.last_update desc
    """

    df = pd.read_sql_query(sql, engine)
    df2 = df.set_index('test1')
    x = df2.groupby(df2.index.hour).mean()
    x['hour'] = x.index
    return x.to_json(orient='records')


if __name__ == "__main__":
    app.run(debug=True, port=5000)
