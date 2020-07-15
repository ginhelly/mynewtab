async function get_weather() {
    let response = await fetch('https://api.openweathermap.org/data/2.5/onecall', {
        headers: {
            appid: 'f8cce0965c6db2b3a0d4b68e985f9e9a',
            lat: 56.852399,
            lon: 53.211291,
            exclude: 'minutely'
        }
        });

    if (response.ok) { 
    let myjson = await response.json();
    } else {
    alert("Ошибка HTTP: " + response.status);
    myjson = null;
    }

    console.log(myjson)
}

window.onload = get_weather();