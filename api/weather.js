const WB_KEY  = 'a219b2ee03e84c7ca6c117667b4047d7';
const OWM_KEY = 'add3efdf125dc186f7a4ff1b6f0c32ad';
const WAPI_KEY = '376855391f6646f585f45344262904';
const LAT = 37.5665, LON = 126.978;

function dateOffset(n) {
  const kst = new Date(Date.now() + 9 * 3600000 + n * 86400000);
  return kst.getUTCFullYear() + '-' + String(kst.getUTCMonth()+1).padStart(2,'0') + '-' + String(kst.getUTCDate()).padStart(2,'0');
}

function wmoIcon(c) {
  if(c===0) return'☀️'; if(c<=2) return'🌤️'; if(c===3) return'☁️';
  if(c<=48) return'🌫️'; if(c<=57) return'🌦️'; if(c<=67) return'🌧️';
  if(c<=77) return'🌨️'; if(c<=82) return'🌦️'; if(c<=86) return'🌨️';
  if(c<=99) return'⛈'; return'❓';
}
function wbIcon(c) {
  if(c===800) return'☀️'; if(c>800&&c<900) return c<=802?'⛅':'☁️';
  if(c>=200&&c<300) return'⛈'; if(c>=300&&c<400) return'🌦️';
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
function kmaRssIcon(wf) {
  if(!wf) return'❓';
  if(wf.includes('맑음')) return'☀️'; if(wf.includes('구름조금')) return'🌤️';
  if(wf.includes('구름많음')) return'⛅'; if(wf.includes('비')) return'🌧️';
  if(wf.includes('눈')) return'🌨️'; if(wf.includes('흐림')) return'☁️'; return'🌤️';
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

async function fetchKMARSS() {
  const r = await fetch('https://script.google.com/macros/s/AKfycbzRf-Z4ujjerK5zBRA9myDJDTNcPwXHdnGrliSeKR7r-x8YOWh-6M67nFEbPJ1D6fnS/exec?source=kma');
  const d = await r.json();
  if(d.error) throw new Error(d.error);
  return d.data;
}

  // <location> 블록에서 서울 데이터 추출
  const locMatch = xml.match(/<location wl_ver="3">([\s\S]*?)<\/location>/g);
  if(!locMatch) throw new Error('RSS location not found');

  // 서울 블록 찾기
  let seoulBlock = null;
  for(let i=0;i<locMatch.length;i++){
    if(locMatch[i].includes('<city>서울</city>')||locMatch[i].includes('서울')) {
      seoulBlock = locMatch[i];
      break;
    }
  }
  if(!seoulBlock) seoulBlock = locMatch[0];

  // <data> 블록들 파싱
  const dataBlocks = seoulBlock.match(/<data>([\s\S]*?)<\/data>/g)||[];
  const data = [];

  dataBlocks.forEach(function(block) {
    const dateM = block.match(/<tmEf>([\s\S]*?)<\/tmEf>/);
    const tmaxM = block.match(/<taMax>([\s\S]*?)<\/taMax>/);
    const tminM = block.match(/<taMin>([\s\S]*?)<\/taMin>/);
    const popM  = block.match(/<rnSt>([\s\S]*?)<\/rnSt>/);
    const wfM   = block.match(/<wf>([\s\S]*?)<\/wf>/);

    if(!dateM) return;
    const dateStr = dateM[1].trim().split(' ')[0]; // YYYY-MM-DD
    const existing = data.find(function(d){ return d.date===dateStr; });

    if(!existing) {
      data.push({
        date: dateStr,
        icon: kmaRssIcon(wfM?wfM[1].trim():''),
        max:  tmaxM ? parseInt(tmaxM[1].trim()) : null,
        min:  tminM ? parseInt(tminM[1].trim()) : null,
        pop:  popM  ? parseInt(popM[1].trim())  : 0,
      });
    }
  });

  if(!data.length) throw new Error('RSS parse failed');
  return data.slice(0,10);
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
    const pops  = items.map(function(i){ return (i.pop||0)*100; });
    const mid   = items[Math.floor(items.length/2)];
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
    { name: 'KMA',         color: '#f472b6', fn: fetchKMARSS      },
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
