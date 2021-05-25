/* Architecture
1. When index.html page loads, runs 2 functions;
i. initIndex()
    -> initDatePicker();initLocationPicker();initActionButton();initGoButton();
    -> getCurrentWeather();
ii. initCharts() -> initMap() -> loadMap("", 0.0, 0.0);

2. When Go button is clicked;
onclickGo()
i. if time now or within the hour, no predictions, current realtime stations and weather, just like if page initially loaded, independent functions i.e. not relying on result of current data fetch to feed a prediction
    -> getCurrentWeather();
       initMap();
ii. OR if time more than 1 hour from now, fetch weather information, feed parameters to loadMpa for prediction
    -> getHourlyWeather() -> loadMap(weather_main, temp, wind_speed);
    -> getDailyWeather() -> loadMap(weather_main, temp, wind_speed);
*/

// Global variables
let map, infoWindow;
var markers = []; // global array to store the marker object, to track s
var pos; // user's geolocation
// Filter variables
var filterDate = new Date();
var filterLocation = 'All Stations'; // by default user has not selected preference of any station
var filterAction = 'Rent & Return'; // by default user has not selected preference of Rent or Return
var stationNames = [];

// Google Map - Charts and Map initialisation
function initCharts() {
    google.charts.load('current', {'packages': ['corechart']});
    google.charts.setOnLoadCallback(initMap);
}

// initMap wrapper for loadMap, only uses arguments if doing prediction
function initMap() {
    loadMap("", 0.0, 0.0);
}

function loadMap(weather_main, temp, wind_speed) {

    // Fetch stations snapshot data - most recent availability information
    fetch("/stations").then(response => {
        return response.json();
       }).then(data => {
            console.log("loadMap - /stations/ data: ", data);

        // 1. Google Map - Dublin
        map = new google.maps.Map(document.getElementById("map"), {
                center: { lat: 53.349804, lng: -6.260310},
                zoom: 13.4,
             });

        // 2. Google Map - Legend
        const iconBase = "/static/images/";
        const icons = {
            userLocation: {
                name: "Your location",
                icon: iconBase + "user-location.png",
            },
            stationDefault: {
                name: "Bike Station",
                icon: iconBase + "default-dot.png",
            },
            stationYellow: {
                name: "Selected Station",
                icon: iconBase + "yellow-dot.png",
            },
            stationGreen: {
                name: "More than 25% available",
                icon: iconBase + "green-dot.png",
            },
            stationOrange: {
                name: "Less than 25% available",
                icon: iconBase + "orange-dot.png",
            },
            stationRed: {
                name: "No availability",
                icon: iconBase + "red-dot.png",
            },
        }
        const legend = document.createElement('div');
        legend.id = 'legend';
        const header = document.createElement("h3");
        header.innerHTML = "Legend";
        legend.appendChild(header);

        for (const key in icons) {
            const type = icons[key];
            const name = type.name;
            const icon = type.icon;
            const div = document.createElement("div");
            div.innerHTML = '<img src="' + icon + '"> ' + name;
            legend.appendChild(div);
        }
        map.controls[google.maps.ControlPosition.LEFT_TOP].push(legend);


        // 3. Google Map - User's Geolocation
        if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                pos = { lat: position.coords.latitude, lng: position.coords.longitude,}; //  EC2 instance -> pos = { lat: 53.3319575, lng: -6.29664969,};
                const marker = new google.maps.Marker({
                        position: { lat: pos.lat, lng: pos.lng }, // Temple bar {lat: 53.3449, lng: -6.2675}
                        map: map,
                        icon: {url: "/static/images/user-location.png"},
                })
            },
            () => {
                console.log("loadMap - ERROR: Browser doesn't support Geolocation");
            }
        );
        } else {
            console.log("loadMap - ERROR: Browser doesn't support Geolocation");
        }

        // 4. Google Map - onclick function - "Pan to Current Location"
        const locationButton = document.createElement("button");
        locationButton.textContent = "Pan to Current Location";
        locationButton.classList.add("custom-map-control-button");
        map.controls[google.maps.ControlPosition.TOP_CENTER].push(locationButton);
        locationButton.addEventListener("click", () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
            map.setCenter(pos);
            },
            () => {
                console.log("loadMap - ERROR: Browser doesn't support Geolocation");
                }
            );
        });

        // 5. realtimeOrPrediction
        data.forEach(stations => {
               // Only creating a marker for the stations selected in the dropdown
               if ((filterLocation != 'All Stations') && (filterLocation != stations.name)) {
                    console.log("loadMap - NOT creating Marker - Station NOT selected: ", stations.name);
                    stationNames.includes(stations.name)
               } else {
                    console.log("loadMap - creating Marker - Station selected: ", stations.name);
                    realtimeOrPrediction(stations, weather_main, temp, wind_speed);
        }
        });

        }).catch(err => {
            console.log("loadMap - ERROR: ", err);
            })
    }

// async
function realtimeOrPrediction(stations, weather_main, temp, wind_speed) {

    var time0 = new Date(filterDate); // cast string "2021-04-01T09:44" to date object
    var time1 = new Date();
    time1.setHours(time1.getHours() + 1);

    if (time0 <= time1) {
        // if less than 1 hour from current time, then query CURRENT stations availability
        console.log('realtimeOrPrediction - DatePicker LESS THAN 1 hour in future - fetch CURRENT stations availability ');
        var last_update = new Date(stations.last_update); // epoch converter // var dt = new Date(stations.last_update); // iii. convert back to local (IST) time after querying database (UTC)
        populateMap("Current", stations.name, stations.number, stations.pos_lat, stations.pos_lng, stations.bike_stands, stations.available_bikes, stations.available_bike_stands, last_update);
    } else {
        // otherwise make PREDICTION
        console.log('realtimeOrPrediction - DatePicker MORE THAN 1 hour in future - make PREDICTION on stations availability ');

         // correct Weekday to Day number mapping
         //                                                time0.getDay() -> {Mon:1, Tues:2, Wed:3, Thurs:4, Fri:5, Sat:6, Sun:0}
         // Models were trained with -> df['hour'] = df.Date_time.dt.hour -> {Mon:0, Tues:1, Wed:2, Thurs:3, Fri:4, Sat:5, Sun:6}
         var day;
         if (time0.getDay() == 0) {
            day = 6;
         } else {
            day = time0.getDay() -1;
         }

         // await
        predict(stations.name, stations.number, stations.pos_lat, stations.pos_lng, stations.bike_stands, time0, day, time0.getHours(), weather_main, temp, wind_speed);
    }
 }

// async
function predict(name, number, pos_lat, pos_lng, bike_stands, time0, day, hour, weather_main, temp, wind_speed) {
        // arr = ["station_number", "day", "hour", 'weather_main', 'temp', 'wind_speed']
        console.log("predict - /predict/" + number + "/" + day + "/" + hour + "/" + weather_main + "/" + temp + "/" + wind_speed);
        // return
        fetch("/predict/" + number + "/" + day + "/" + hour + "/" + weather_main + "/" + temp + "/" + wind_speed).then(response => {
            return response.json();
       }).then(prediction => {
        console.log("predict - prediction data: ", prediction);
                populateMap("Predicted", name, number, pos_lat, pos_lng, bike_stands, prediction.available_bikes, prediction.available_bike_stands, time0); // what user has in Datetime picker
        }).catch(err => {
            console.log("predict - ERROR: ", err);
            })
}

function populateMap(type, name, number, pos_lat, pos_lng, bike_stands, available_bikes, available_bike_stands, last_update) {

            console.log("populateMap - args:", name, number, pos_lat, pos_lng, bike_stands, available_bikes, available_bike_stands,last_update);

            // Google Maps - Markers - Icon colours
            var iconColor;
            // if user is interested in both Renting and Returning a bike
            if (filterAction == "Rent & Return") {
                iconColor = "default";
            } else if (filterAction == "Rent") {
            // if user is interested in only renting a bike then only concerned with available_bikes
                iconColor = calculateIconColor(bike_stands, available_bikes);
            } else if (filterAction == "Return") {
                // if user is interested in only returning a bike then only concerned with available_bike_stands
                iconColor = calculateIconColor(bike_stands, available_bike_stands);
            }

            // Google Maps - Markers
            const marker = new google.maps.Marker({
                position: { lat: parseFloat(pos_lat), lng: parseFloat(pos_lng) },
                map: map,
                originalColor: iconColor, // color stored in Marker object as "originalColor" so can revert colour when unselected
                icon: {url: getIconPath(iconColor)}, // default red marker is slightly bigger than this image, so use own set of images
                title: name,
            });
            // When user clicks on marker (1-4);
            marker.addListener("click", () => {

                // 1. Google Maps - Charts
                console.log('calling drawOccupancyWeekly: ' + number);
                drawOccupancyWeekly(number);

                // 2. Google Maps - Distance - for every station calculate distance & duration cycling from user & display in Station div
                var destination = {lat: parseFloat(pos_lat), lng: parseFloat(pos_lng) };
                getDistanceBetween(pos, {lat: parseFloat(pos_lat), lng: parseFloat(pos_lng) });

                // 3. Station div
                var station_info = '';
                station_info += '<h2>Station</h2>';
                station_info += '<h3> ' + name + ' </h3>';
                station_info += '<p>' + last_update.toLocaleString() + '</p>';
                //station_info += '<p> Total bike stands: ' + bike_stands + '</p>'; // for debugging
                station_info += '<p1> ' + type + ':</p1>';
                station_info += '<p class="' + ((filterAction == "Rent") ? 'actionSelected' : '') + '">Bikes available: ' + available_bikes + '</p>';
                station_info += '<p class="' + ((filterAction == "Return") ? 'actionSelected' : '') + '">Stands available: ' + available_bike_stands + '</p>';
                //station_info += '<p> stations.number: ' + number + '</p>'; // for debugging
                document.getElementById('station').innerHTML = station_info;
            });
            // 4. Google Maps - Marker - change icon colour
            marker.addListener('click', changeColor);
            markers.push(marker); // add marker to list markers
}


function getDistanceBetween(origin, destination) {
// getDistanceBetween({ lat: 53.356769, lng: -6.26814}, { lat: 53.351182, lng: -6.269859});
  const service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix(
    {
      origins: [origin],
      destinations: [destination],
      travelMode: google.maps.TravelMode.BICYCLING,
      unitSystem: google.maps.UnitSystem.METRIC,
    },
    (response, status) => {
      if (status !== "OK") {
        alert("Error was: " + status);
      } else {
        var distance_info = '';
        distance_info += '<br> Distance cycling from me: ' + response.rows[0].elements[0].distance.text;
        distance_info += '<br> Duration cycling from me: ' + response.rows[0].elements[0].duration.text;
        document.getElementById("distance").innerHTML = distance_info;
         }
    }
  );
}

function drawOccupancyWeekly(station_number) {

    fetch("/occupancy/" + station_number).then(response => {
        return response.json();
       }).then(data => {

            document.getElementById("chart").innerHTML = ""; // Bug fix - chart diminishing in size on every click of marker

            var item;
            if (filterAction == "Rent & Return" || filterAction == "Rent" ) {
                item = "bikes";
           } else if (filterAction == "Return") {
                item = "stands";
            }

            var options = {
                title:"Average number of available " + item + " throughout the day at selected station",
                fontSize: 25,
                fontName: 'Arial, Helvetica, sans-serif',
                vAxis:{"title":"Average number of available " + item},
                hAxis:{"title":"Hours of Day"},
                legend: 'none',
                width: 1500,
                height: 500,
                colors: ['#325F56']
            }
            // Bug fix - Uncaught (in promise) TypeError: Cannot read property 'ColumnChart' of undefined -> needed www.gstatic.com and initCharts in index.html
            var chart = new google.visualization.ColumnChart(document.getElementById('chart'));
            var chart_data = new google.visualization.DataTable();
            chart_data.addColumn('number', "Hour of Day");
            chart_data.addColumn('number', "Bike Availability");
            data.forEach(result => {
                console.log("occupancy", result);
                if (filterAction == "Rent & Return" || filterAction == "Rent" ) {
                    chart_data.addRow([result.hour, parseInt(result.available_bikes)]);
                } else if (filterAction == "Return") {
                    chart_data.addRow([result.hour, parseInt(result.available_bike_stands)]);
            }
            })
            chart.draw(chart_data, options);
        });
}

// Icon colors
function getIconPath (color) {
    return "/static/images/" + color + "-dot.png";
}

function calculateIconColor(bike_stands,available_item) {
	console.log("calculateIconColor - available_item / bike_stands: ", available_item ," / ", bike_stands);
	var div = available_item / bike_stands;
	console.log("calculateIconColor - div: ", div);
	//if there are no available_item (available_bikes/available_bike_stands), display red marker
	if (available_item == 0) {
		return "red";
	}
	// if there are less than 25% of available_item (available_bikes/available_bike_stands) left for this station, display orange marker
	else if (div <= 0.25) {
		return "orange";
	}
	// if there are more than 25% of available_item (available_bikes/available_bike_stands) left for this station, display green marker
	else if (div > 0.25) {
		return "green";
	}
	// debug - if issue with division here, display blue marker
	else {
		return "blue";
	}
}

function changeColor(evt) {
  restoreColors(); // so last selected icon changes from yellow to original color
  this.setIcon({url: getIconPath("yellowBig")});
}

// for every marker made for each station, lookup what the original color marker was when marker was first created, avoid recalculating recalculate
function restoreColors() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setIcon({url: getIconPath(markers[i].originalColor)});
  }
  }

// initIndex - function to initialise rest of the divs on the grid-container
function initIndex() {
    // 1. Filters
    initDatePicker();
    initLocationPicker();
    initActionButton();
    initGoButton();
    // 2. Populate weather div
    getCurrentWeather();
}

// Filters / Dropdowns
// 1. Date Picker
function initDatePicker() {
    var now = new Date(); // "min" and "value" attributes use now variable
    var max = new Date(); // "max" attribute use max variable
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    max.setMinutes(max.getMinutes() - max.getTimezoneOffset() + 10080); // add 1 week = 10080 mins

    var out = '';
    //  out += '<input type="datetime-local" id="dateValue"  value="2021-03-29T19:30" min="2021-03-29T19:30" max="2021-04-05T19:30">';
    //  type="date" for next 7 days
    out += '<input type="datetime-local" id="dateValue"  value="' + now.toISOString().slice(0,16) + '" min="' + now.toISOString().slice(0,16) + '" max="' + max.toISOString().slice(0,16) + '">';
    document.getElementById("date").innerHTML = out;
}

// 2. Location Picker
async function initLocationPicker() {
    // get stationNames -  AWAIT to finish otherwise array does not get made in dropdown - "this value was evaluated upon first expanding"
    await createStationNamesArray();
    console.log("initLocationPicker - stationNames length: ", stationNames.length);
    stationNames.sort(); // sort stations alphabetically
    stationNames.unshift("All Stations"); // add option to beginning of array

    // Create a dropdown of stations ["All Stations", "Nearest cycling available", "Station1", "Station2" ...]
    var out = '';
    out += '<select id="locationValue">';
    for (var i = 0; i < stationNames.length; i++) {
        // dynamically assign the default "selected" filterLocation
        out += '<option value="' + stationNames[i] + '" ' + ((filterLocation == stationNames[i]) ? 'selected>' : '>') + stationNames[i] + '</option>';
    }
    out += '</select>';

    document.getElementById("location").innerHTML = out;
}

// Asynchronous function used by initLocationPicker
async function createStationNamesArray() {
    return fetch("/stations").then(response => {
        return response.json();
       }).then(data => {
       console.log("createStationNamesArray - data: ", data);
        data.forEach(stations => {
            stationNames.push(stations.name);
        });
        }).catch(err => {
            console.log("createStationNamesArray - ERROR: ", err);
            })
}

// 3. Action - Rent / Return
function initActionButton() {

    var actionOptions = ["Rent & Return", "Rent", "Return"];

    // Create a dropdown of actions
    var out = '';
    out += '<select id="actionValue">';
    for (var i = 0; i < actionOptions.length; i++) {
        // dynamically assign the default "selected" filterAction
        out += '<option value="' + actionOptions[i] + '" ' + ((filterAction == actionOptions[i]) ? 'selected>' : '>') + actionOptions[i] + '</option>';
    }
    out += '</select>';

    document.getElementById("action").innerHTML = out;
}

// 4. Go button
function initGoButton() {
    var out = '';
    out += '<button class="button buttonSelected" onclick="onclickGo()">Go</button>';
    document.getElementById("go").innerHTML = out;
}

// When user clicks Go button
function onclickGo(){
    // 1. update the Global variables based on what user has currently in filter divs - acting like a form
    filterDate = document.getElementById("dateValue").value;
    filterLocation = document.getElementById("locationValue").value;
    filterAction = document.getElementById("actionValue").value;

    // 2. Clear current information being displayed, new query now in progress
    document.getElementById("map").innerHTML = "";
    //document.getElementById("legend").innerHTML = "";
    document.getElementById("weather").innerHTML = "<h2>Weather</h2><p><br>Loading. Please wait.</p>";
    document.getElementById("station").innerHTML = "<h2>Station</h2><p><br>Click the markers on the map <br> for more station information.</p>";
    document.getElementById("distance").innerHTML = "";
    document.getElementById("chart").innerHTML = "";

    // 3. Weather
    // i. Datetime picker and new Date times are in LOCAL time i.e. April 2021 in IST, do comparisons test conditions
    var time0 = new Date(filterDate); // cast string "2021-04-01T09:44" to date object
    var time1 = new Date();
    var time2 = new Date();
    time1.setHours(time1.getHours() + 1);
    time2.setHours(time2.getHours() + 48);
    console.log('onclickGo    filterDate (local):', time0);
    console.log('onclickGo    filterDate + 1hr (local):', time1);
    console.log('onclickGo    filterDate + 48hr (local):', time2);

    if (time0 <= time1) {
        // if less than 1 hour from current time, then query CURRENT weather data
        getCurrentWeather(); // no args, selecting max date from weather table in database
        initMap();
    } else if ((time0 > time1) && (time0 <= time2)) {
        // else if more than 1 hour from current time AND less than 2 days, then query HOURLY weather data
        // ii. query database (weather and stations) using UTC - toISOString converts to UTC time
        getHourlyWeather("'" + time0.toISOString().slice(0,16).replace("T", " ") + "'"); // get into format "'2021-04-02 09:45:11'"
    } else if (time0 > time2) {
        // else if more than 2 days (less than 7) then query DAILY weather data, then query DAILY weather data
        getDailyWeather("'" + time0.toISOString().slice(0,16).replace("T", " ") + "'");
    }
}

function getCurrentWeather() {
        fetch("/weather").then(response => {
            return response.json();
       }).then(data => {
        data.forEach(weather => {
            // Weather Widget - div
            var dt = new Date(weather.dt);  // epoch converter // iii. convert back to local (IST) time after querying database (UTC)
            var weather_info = '';
            weather_info += '<br><h2>Weather</h2>';
            weather_info += '<p>' + dt.toLocaleString() + '</p>';
            // convert Kelvin to Celsius  K: x + 273.15
            weather_info += '<div style="color:#325F56;font-size: 75px;">' + getWeatherIconPath(weather.weather_icon) + ' ' + Math.ceil(weather.main_temp - 273.15) + '<sup>°C</sup></div>'; // Move styling to css file
            weather_info += '<p>Main: ' + weather.weather_main + '</p>';
            weather_info += '<p>Wind Speed: ' + weather.wind_speed + '</p>';
            document.getElementById('weather').innerHTML = weather_info;
        });
        }).catch(err => {
            console.log("getCurrentWeather - ERROR: ", err);
            })
    }

function getHourlyWeather(dateSelected) {
        console.log('getHourlyWeather - dateSelected:', dateSelected);
        fetch("/hourly/" + dateSelected).then(response => { // http://localhost:5000/hourly/'2021-04-02%2009:45:11'
            return response.json();
       }).then(data => {
        data.forEach(hourly => {
           console.log('hourly weather data:', data);
           // 1. Weather Widget - div
            var future_dt = new Date(hourly.future_dt); // iii. convert back to local (IST) time after querying database (UTC)
            var weather_info = '';
            weather_info += '<br><h2>Weather</h2>';
            weather_info += '<p>' + future_dt.toLocaleString() + '</p>';
            weather_info += '<div style="color:#325F56;font-size: 75px;">' + getWeatherIconPath(hourly.weather_icon) + ' ' + Math.ceil(hourly.temp - 273.15) + '<sup>°C</sup></div>';
            weather_info += '<p>Main: ' + hourly.weather_main + '</p>';
            weather_info += '<p>Wind Speed: ' + hourly.wind_speed + '</p>';
            document.getElementById('weather').innerHTML = weather_info;

        // 2. loadMap - run prediction with forcasted weather information
        console.log('getHourlyWeather:', hourly.weather_main, hourly.temp, hourly.wind_speed);
        loadMap(hourly.weather_main, hourly.temp, hourly.wind_speed);

        });
        }).catch(err => {
            console.log("getHourlyWeather - ERROR: ", err);
            })
    }

function getDailyWeather(dateSelected) {
        console.log('getDailyWeather - dateSelected:', dateSelected);
        fetch("/daily/" + dateSelected).then(response => { // http://localhost:5000/daily/'2021-04-02%2009:45:11'
            return response.json();
       }).then(data => {
       console.log('daily weather data:', data);
        data.forEach(daily => {
           console.log('daily weather data:', data);
           // 1. Weather Widget - div
            var future_dt = new Date(daily.future_dt);
            var weather_info = '';
            weather_info += '<br><h2>Weather</h2>';
            weather_info += '<p>' + future_dt.toLocaleDateString() + '</p>'; // just the Date, not the 1pm, meaningless
            weather_info += '<div style="color:#325F56;font-size: 75px;">' + getWeatherIconPath(daily.weather_icon) + ' ' + Math.ceil(getDailyWeatherTemp(daily) - 273.15) + '<sup>°C</sup></div>';
            weather_info += '<p>Main: ' + daily.weather_main + '</p>';
            weather_info += '<p>Wind Speed: ' + daily.wind_speed + '</p>';
            document.getElementById('weather').innerHTML = weather_info;

        // 2. loadMap - run prediction with forcasted weather information
        console.log('getDailyWeather:', daily.weather_main, getDailyWeatherTemp(daily), daily.wind_speed);
        loadMap(daily.weather_main, getDailyWeatherTemp(daily), daily.wind_speed);

        });
        }).catch(err => {
            console.log("getDailyWeather - ERROR: ", err);
            })
    }

// choose the temperature (temp_morn, temp_day, temp_eve, temp_night) closest to filterDate
function getDailyWeatherTemp(daily) {
    var hourOfDay = filterDate.substr(11, 2); // start index 11, take 2 HH digits
    console.log('getDailyWeatherTemp - hours:', hourOfDay);
    if ((hourOfDay >= 4) && (hourOfDay < 12)) { // Morning - 5am-12pm (noon)
        return daily.temp_morn;
    } else if ((hourOfDay >= 12) && (hourOfDay < 17)){ // Afternoon - 12pm-5pm
        return daily.temp_day;
    } else if ((hourOfDay >= 17) && (hourOfDay < 21)){ // Evening - 5pm - 9pm
        return daily.temp_eve;
    } else if ((hourOfDay >= 21 ) || (hourOfDay < 4)){  // Night - 9pm - 4am
        return daily.temp_night;
    }
}
function getWeatherIconPath (weather_icon) {
    var src = "http://openweathermap.org/img/wn/" + weather_icon + "@2x.png";
    return '<img class="border" src= "' + src + '" alt="weather_icon" width="100" height="100"></img>';
}