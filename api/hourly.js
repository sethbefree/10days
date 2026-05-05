const OWM_KEY  = 'add3efdf125dc186f7a4ff1b6f0c32ad';
const WAPI_KEY = '376855391f6646f585f45344262904';
const TMW_KEY  = 'rLgugfHYqEEoKnc91yU74wvxZoACo61E';
const WWO_KEY  = '183bcc4e96b34a62a24144911260205';
const LAT = 37.5047, LON = 127.0014;
const UA = 'Mozilla/5.0';

function wmoIcon(c) {
  if(c===0) return'☀️'; if(c<=2) return'🌤️'; if(c===3) return'☁️';
  if(c<=48) return'🌫️'; if(c<=57) return'🌦️'; if(c<=67) return'🌧️';
  if(c<=77) return'🌨️'; if(c<=82) return'🌦️'; if(c<=86) return'🌨️';
  if(c<=99) return'⛈️'; return'❓';
}
function phraseIcon(t) {
  t=(t||'').toLowerCase();
  if(t.includes('thunder')) return'⛈️'; if(t.includes('snow')) return'🌨️';
  if(t.includes('rain')||t.includes('drizzle')) return'🌧️';
  if(t.includes('fog')||t.includes('mist')) return'🌫️';
  if(t.includes('overcast')) return'☁️'; if(t.includes('cloud')) return'⛅';
  if(t.includes('sunny')||t.includes('clear')) return'☀️'; return'🌤️';
}
function tmwIcon(c) {
  if(c===1000) return'☀️'; if(c<=1101) return'🌤️'; if(c<=1001) return'☁️';
  if(c<=2100) return'🌫️'; if(c<=4200) return'🌦️'; if(c<=4999) return'🌧️';
  if(c<=5999) return'🌨️'; if(c>=8000) return'⛈️'; return'🌤️';
}
function owmIcon(id) {
  if(id>=200&&id<300) return'⛈️'; if(id>=300&&id<400) return'🌦️';
  if(id>=500&&id<600) return'🌧️'; if(id>=600&&id<700) return'🌨️';
  if(id>=700&&id<800) return'🌫️'; if(id===800) return'☀️';
  if(id>800) return'☁️'; return'🌤️';
}

function kstHour(utcStr) {
  const ms = new Date(utcStr).getTime() + 9*3600000;
  const d = new Date(ms);
  return String(d.getUTCHours()).padStart(2,'0') + ':00';
}
function kstDate(utcStr) {
  const ms = new Date(utcStr).getTime() + 9*3600000;
  const d = new Date(ms);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
}

async function fetchOpenMeteoHourly(date) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&forecast_days=10&timezone=Asia/Seoul`);
  const d = await r.json();
  const out = [];
  d.hourly.time.forEach(function(t, i) {
    const dateStr = t.split('T')[0];
    if(dateStr !== date) return;
    const hour = t.split('T')[1].substring(0,5);
    out.push({
      time: hour,
      icon: wmoIcon(d.hourly.weathercode[i]),
      temp: Math.round(d.hourly.temperature_2m[i]),
      pop:  d.hourly.precipitation_probability[i] || 0,
      wind: Math.round(d.hourly.windspeed_10m[i] * 10) / 10,
    });
  });
  return out;
}

async function fetchWWOHourly(date) {
  const r = await fetch(`https://api.worldweatheronline.com/premium/v1/weather.ashx?key=${WWO_KEY}&q=Seoul&date=${date}&enddate=${date}&tp=1&format=json`);
  const d = await r.json();
  const hours = d.data && d.data.weather && d.data.weather[0] && d.data.weather[0].hourly;
  if(!hours) throw new Error('no data');
  return hours.map(function(h) {
    const hNum = parseInt(h.time) / 100;
    return {
      time: String(hNum).padStart(2,'0') + ':00',
      icon: phraseIcon(h.weatherDesc && h.weatherDesc[0] && h.weatherDesc[0].value || ''),
      temp: parseInt(h.tempC),
      pop:  parseInt(h.chanceofrain || 0),
      wind: Math.round(parseFloat(h.windspeedKmph) / 3.6 * 10) / 10,
    };
  });
}

async function fetchOWMHourly(date) {
  const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${OWM_KEY}&units=metric&cnt=40`);
  const d = await r.json();
  const out = [];
  d.list.forEach(function(item) {
    if(kstDate(item.dt_txt) !== date) return;
    out.push({
      time: kstHour(item.dt_txt),
      icon: owmIcon(item.weather[0].id),
      temp: Math.round(item.main.temp),
      pop:  Math.round((item.pop||0)*100),
      wind: Math.round(item.wind.speed * 10) / 10,
    });
  });
  return out;
}

async function fetchWeatherAPIHourly(date) {
  const r = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${WAPI_KEY}&q=${LAT},${LON}&days=3&aqi=no`);
  const d = await r.json();
  if(d.error) throw new Error(d.error.message);
  const day = d.forecast.forecastday.find(function(fd){ return fd.date === date; });
  if(!day) throw new Error('date not in range');
  return day.hour.map(function(h) {
    const t = new Date(h.time_epoch * 1000 + 9*3600000);
    return {
      time: String(t.getUTCHours()).padStart(2,'0') + ':00',
      icon: phraseIcon(h.condition.text),
      temp: Math.round(h.temp_c),
      pop:  h.chance_of_rain || 0,
      wind: Math.round(h.wind_kph / 3.6 * 10) / 10,
    };
  });
}

async function fetchTomorrowHourly(date) {
  const r = await fetch(`https://api.tomorrow.io/v4/weather/forecast?location=${LAT},${LON}&timesteps=1h&units=metric&apikey=${TMW_KEY}`);
  const d = await r.json();
  const hours = d.timelines && d.timelines.hourly;
  if(!hours) throw new Error('no data');
  const out = [];
  hours.forEach(function(h) {
    if(kstDate(h.time) !== date) return;
    const v = h.values;
    out.push({
      time: kstHour(h.time),
      icon: tmwIcon(v.weatherCode || 1000),
      temp: Math.round(v.temperature),
      pop:  Math.round(v.precipitationProbability || 0),
      wind: Math.round(v.windSpeed * 10) / 10,
    });
  });
  return out;
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');

  const date = req.query.date;
  if(!date) return res.status(400).json({ error: 'date required' });

  const SOURCES = [
    { name: 'Open-Meteo', color: '#6b8c6b', interval: '1h', fn: fetchOpenMeteoHourly },
    { name: 'WWO',        color: '#5a7a8a', interval: '1h', fn: fetchWWOHourly        },
    { name: 'W.API',      color: '#8b6f9e', interval: '1h', fn: fetchWeatherAPIHourly },
    { name: 'Tomorrow',   color: '#fb923c', interval: '1h', fn: fetchTomorrowHourly   },
    { name: 'OWM',        color: '#a07850', interval: '3h', fn: fetchOWMHourly        },
  ];

  const results = await Promise.allSettled(SOURCES.map(function(s){ return s.fn(date); }));
  const sources = SOURCES.map(function(s, i) {
    return {
      name:     s.name,
      color:    s.color,
      interval: s.interval,
      data:     results[i].status === 'fulfilled' ? results[i].value : [],
      error:    results[i].status === 'rejected'  ? results[i].reason.message : null,
    };
  });

  res.json({ date: date, sources: sources });
};
