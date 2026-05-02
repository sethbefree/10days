const WB_KEY  = 'a219b2ee03e84c7ca6c117667b4047d7';
const OWM_KEY = 'add3efdf125dc186f7a4ff1b6f0c32ad';
const WAPI_KEY = '376855391f6646f585f45344262904';
const KMA_KEY = 'a9554587103d1866c1f58b897f7b5465ca0dd21ce9d4a343cf5461bb906c1a91';
const LAT = 37.5665, LON = 126.978;

function dateOffset(n) {
  const kst = new Date(Date.now() + 9 * 3600000 + n * 86400000);
  return kst.getUTCFullYear() + '-' + String(kst.getUTCMonth()+1).padStart(2,'0') + '-' + String(kst.getUTCDate()).padStart(2,'0');
}

function getKMABase() {
  const kst = new Date(Date.now() + 9 * 3600000);
  const h = kst.getUTCHours();
  const date = String(kst.getUTCFullYear()) + String(kst.getUTCMonth()+1).padStart(2,'0') + String(kst.getUTCDate()).padStart(2,'0');
  const ydKst = new Date(Date.now() - 86400000 + 9 * 3600000);
  const yd = String(ydKst.getUTCFullYear()) + String(ydKst.getUTCMonth()+1).padStart(2,'0') + String(ydKst.getUTCDate()).padStart(2,'0');
  if (h >= 18) return date + '1800';
  if (h >= 6)  return date + '0600';
  return yd + '1800';
}

function wmoIcon(c) {
  if(c===0) return'☀️'; if(c<=2) return'🌤️'; if(c===3) return'☁️';
  if(c<=48) return'🌫️'; if(c<=57) return'🌦️'; if(c<=67) return'🌧️';
  if(c<=77) return'🌨️'; if(c<=82) return'🌦️'; if(c<=86) return'🌨️';
  if(c<=99) return'⛈️'; return'❓';
}
function wbIcon(c) {
  if(c===800) return'☀️'; if(c>800&&c<900) return c<=802?'⛅':'☁️';
  if(c>=200&&c<300) return'⛈️'; if(c>=300&&c<400) return'🌦️';
  if(c>=500&&c<600) return'🌧️'; if(c>=600&&c<700) return'🌨️'; return'🌫️';
}
function owmIcon(id) {
  if(id>=200&&id<300) return'⛈️'; if(id>=300&&id<400) return'🌦️';
  if(id>=500&&id<600) return'🌧️'; if(id>=600&&id<700) return'🌨️';
  if(id>=700&&id<800) return'🌫️'; if(id===800) return'☀️';
  if(id>800) return'☁️'; return'🌤️';
}
function wapiIcon(t) {
  t=(t||'').toLowerCase();
  if(t.includes('thunder')) return'⛈️'; if(t.includes('snow')||t.includes('blizzard')) return'🌨️';
  if(t.includes('rain')||t.includes('drizzle')) return'🌧️'; if(t.includes('fog')||t.includes('mist')) return'🌫️';
  if(t.includes('overcast')) return'☁️'; if(t.includes('cloud')) return'⛅';
  if(t.includes('sunny')||t.includes('clear')) return'☀️'; return'🌤️';
}
function kmaIcon(c) {
  if(!c) return'❓';
  if(c.includes('맑음')) return'☀️'; if(c.includes('구름조금')) return'🌤️';
  if(c.includes('구름많음')) return'⛅'; if(c.includes('비')) return'🌧️';
  if(c.includes('눈')) return'🌨️'; if(c.includes('흐림')) return'☁️'; return'🌤️';
}

async function fetchOpenMeteo() {
  const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude='+LAT+'&longitude='+LON+'&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&forecast_days=10&timezone=Asia/Seoul');
  const d = await r.json();
  return d.daily.time.map(function(date,i) {
    return { date: date, icon: wmoIcon(d.daily.weathercode[i]),
      max: Math.round(d.daily.temperature_2m_max[i]),
      min: Math.round(d.daily.temperature_2m_min[i]),
      pop: d.daily.precipitation_probability_max[i] || 0 };
  });
}

async function fetchWeatherbit() {
  const r = await fetch('https://api.weatherbit.io/v2.0/forecast/daily?lat='+LAT+'&lon='+LON+'&key='+WB_KEY+'&days=10');
  const d = await r.json();
  if(!d.data) throw new Error('no data');
  return d.data.map(function(x) {
    return { date: x.datetime, icon: wbIcon(x.weather.code),
      max: Math.round(x.max_temp), min: Math.round(x.min_temp), pop: Math.round(x.pop) };
  });
}

async function fetchKMA() {
  const base = getKMABase();
  const B = 'https://apis.data.go.kr/1360000/MidFcstInfoService';
  const key = encodeURIComponent(KMA_KEY);
  const results = await Promise.all([
    fetch(B+'/getMidLandFcst?serviceKey='+key+'&numOfRows=10&pageNo=1&regId=11B00000&tmFc='+base+'&dataType=JSON'),
    fetch(B+'/getMidTa?serviceKey='+key+'&numOfRows=10&pageNo=1&regId=11H10501&tmFc='+base+'&dataType=JSON'),
  ]);
  const lo = await results[0].json();
  const te = await results[1].json();
  const li = lo.response&&lo.response.body&&lo.response.body.items&&lo.response.body.items.item&&lo.response.body.items.item[0];
  const ti = te.response&&te.response.body&&te.response.body.items&&te.response.body.items.item&&te.response.body.items.item[0];
  if(!li||!ti) throw new Error('KMA no data (base='+base+')');
  const data = [];
  for(let i=3;i<=10;i++){
    const pop = Math.max(Number(li['rnSt'+i+'Am']||li['rnSt'+i]||0), Number(li['rnSt'+i+'Pm']||0));
    const cond = li['wf'+i+'Am']||li['wf'+i]||'';
    data.push({ date: dateOffset(i), icon: kmaIcon(cond),
      max: ti['taMax'+i]!=null?Math.round(ti['taMax'+i]):null,
      min: ti['taMin'+i]!=null?Math.round(ti['taMin'+i]):null, pop: pop });
  }
  return data;
}

async function fetchOWM() {
  const r = await fetch('https://api.openweathermap.org/data/2.5/forecast?lat='+LAT+'&lon='+LON+'&appid='+OWM_KEY+'&units=metric&cnt=40');
  const d = await r.json();
  const byDate = {};
  d.list.forEach(function(item) {
    const date = item.dt_txt.split(' ')[0];
    if(!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  });
  return Object.keys(byDate).map(function(date) {
    const items = byDate[date];
    const temps = items.map(function(i){ return i.main.temp; });
    const pops = items.map(function(i){ return (i.pop||0)*100; });
    const mid = items[Math.floor(items.length/2)];
    return { date: date, icon: owmIcon(mid.weather[0].id),
      max: Math.round(Math.max.apply(null,temps)),
      min: Math.round(Math.min.apply(null,temps)),
      pop: Math.round(Math.max.apply(null,pops)) };
  });
}

async function fetchWeatherAPI() {
  const r = await fetch('https://api.weatherapi.com/v1/forecast.json?key='+WAPI_KEY+'&q=Seoul&days=10&aqi=no');
  const d = await r.json();
  if(d.error) throw new Error(d.error.message);
  return d.forecast.forecastday.map(function(day) {
    return { date: day.date, icon: wapiIcon(day.day.condition.text),
      max: Math.round(day.day.maxtemp_c), min: Math.round(day.day.mintemp_c),
      pop: day.day.daily_chance_of_rain||0 };
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');

  const SOURCES = [
    { name: 'Open-Meteo',  color: '#34d399', fn: fetchOpenMeteo  },
    { name: 'Weatherbit',  color: '#60a5fa', fn: fetchWeatherbit  },
    { name: 'KMA',         color: '#f472b6', fn: fetchKMA         },
    { name: 'OpenWeather', color: '#fbbf24', fn: fetchOWM         },
    { name: 'WeatherAPI',  color: '#a78bfa', fn: fetchWeatherAPI  },
  ];

  const results = await Promise.allSettled(SOURCES.map(function(s){ return s.fn(); }));
  const sources = SOURCES.map(function(s,i) {
    return { name: s.name, color: s.color,
      data:  results[i].status==='fulfilled' ? results[i].value : [],
      error: results[i].status==='rejected'  ? results[i].reason.message : null };
  });

  res.json({ sources: sources, updated: new Date().toISOString() });
};
