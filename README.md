Dublin Bikes Web application

The app was hosted on an EC2 instance but we ran out of credits so it no longer exists.  A video of the functioning webapp can be found here: https://youtu.be/kEVJNWop-vQ 

The station data for the app was scraped from the JCDecaux API which provides real time information about the occupancy of each station.  The weather information was taken from the OpenWeatherMap API.  These were stored on an RDS database and used to populate our map and information boxes. 

The application has the following features:
- Datetime, Station and Rent/Return options.
- A Map displaying the user's location and all Dublin Bike stations, which can be clicked for more information. 
- Marker colour codes to provide visual representation of bike / stand availability. 
- A weather widget displaying current and future weather information.
- A station widget displaying current and predicted bike / stand availability as well as cycling distance from user's location. 
- Chart displaying average occupancy of bikes / stands for selected stations. 

Team Members - Andrew Hughes, Rachel Howard, Eoin Hayes 

