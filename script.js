async function APIs(location) {
    try {
        let r = await fetch(`http://api.weatherapi.com/v1/current.json?key=Add_Your_API_Key&q=${location}`);

        if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
        }

        let weather_dict = await r.json();

        let Temp_c = weather_dict['current']['temp_c'];
        let Udt_time = weather_dict['current']['last_updated'];
        let city = weather_dict['location']['name'];
        let region = weather_dict['location']['region'];
        let country = weather_dict['location']['country'];

        return [Temp_c, Udt_time, city, region, country];

    } catch (error) {
        console.log("Error fetching API:", error);
        return [null, null, null, null, null];
    }
}


async function main() {
    try {
        let loc = prompt("Enter location:")
        let [temp_c, udt_time, city, region, country] = await APIs(loc);

        if (temp_c && udt_time && city && region && country) {
            document.getElementById("weather-card").style.display = "block";
            document.getElementById("datetime").innerText = `Last Updated: ${udt_time}`;
            document.getElementById("location").innerText = `Location: ${city}, ${region}, ${country}`;
            document.getElementById("temp").innerText = `Temperature: ${temp_c}°C`;
        } else {
            alert("Could not fetch weather data. Please check your location input or API key.");
        }
    } catch (error) {
        console.log("Main function error:", error);
    }
}
