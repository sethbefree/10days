const KMA_KEY = ‘a9554587103d1866c1f58b897f7b5465ca0dd21ce9d4a343cf5461bb906c1a91’;
const WB_KEY  = ‘a219b2ee03e84c7ca6c117667b4047d7’;
const LAT = 37.5665, LON = 126.978;
const UA = ‘Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36’;

function todayKST() {
return new Date().toLocaleDateString(‘sv-SE’, { timeZone: ‘Asia/Seoul’ });
}

function dateOffset(n) {
const d = new Date();
d.setDate(d.getDate() + n);
return d.toLocaleDateString(‘sv-SE’, { timeZone: ‘Asia/Seoul’ });
}

function getKMABase() {
const now = new Date();
const kstHour = new Date(now.getTime() + 9 * 3600000).getUTCHours();
const kstDate = now.toLocaleDateString(‘sv-SE’, { timeZone: ‘Asia/Seoul’ }).replace(/-/g, ‘’);
const ydDate = new Date(now.getTime() - 86400000).toLocaleDateString(‘sv-SE’, { timeZone: ‘Asia/Seoul’ }).replace(/-/g, ‘’);
if (kstHour >= 18) return kstDate + ‘1800’;
if (kstHour >= 6)  return kstDate + ‘0600’;
return ydDate + ‘1800’;
}

function wmoIcon(c) {
if(c===0) return’☀️’; if(c<=2) return’🌤️’; if(c===3) return’☁️’;
if(c<=48) return’🌫️’; if(c<=57) return’🌦️’; if(c<=67) return’🌧️’;
if(c<=77) return’🌨️’; if(c<=82) return’🌦️’; if(c<=86) return’🌨️’;
if(c<=99) return’⛈️’; return’❓’;
}
function wbIcon(c) {
if(c===800) return’☀️’; if(c>800&&c<900) return c<=802?‘⛅’:‘☁️’;
if(c>=200&&c<300) return’⛈️’; if(c>=300&&c<400) return’🌦️’;
if(c>=500&&c<600) return’🌧️’; if(c>=600&&c<700) return’🌨️’; return’🌫️’;
}
function kmaIcon(c) {
if(!c) return’❓’;
if(c.includes(‘맑음’)) return’☀️’; if(c.includes(‘구름조금’)) return’🌤️’;
if(c.includes(‘구름많음’)) return’⛅’; if(c.includes(‘비’)) return’🌧️’;
if(c.includes(‘눈’)) return’🌨️’; if(c.includes(‘흐림’)) return’☁️’; return’🌤️’;
}
function accuIcon(n) {
if(!n) return’❓’; n=parseInt(n);
if(n<=5) return’☀️’; if(n<=8) return’🌤️’; if(n<=11) return’☁️’;
if(n<=14) return’🌧️’; if(n<=17) return’⛈️’; if(n<=23) return’🌨️’; return’🌤️’;
}
function phraseIcon(p) {
p=(p||’’).toLowerCase();
if(p.includes(‘thunder’)) return’⛈️’; if(p.includes(‘snow’)||p.includes(‘sleet’)) return’🌨️’;
if(p.includes(‘rain’)||p.includes(‘shower’)||p.includes(‘drizzle’)) return’🌧️’;
if(p.includes(‘fog’)||p.includes(‘mist’)) return’🌫️’; if(p.includes(‘overcast’)) return’☁️’;
if(p.includes(‘cloud’)||p.includes(‘partly’)) return’⛅’;
if(p.includes(‘sunny’)||p.includes(‘clear’)) return’☀️’; return’🌤️’;
}

async function fetchOpenMeteo() {
const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&forecast_days=10&timezone=Asia/Seoul`);
const d = await r.json();
return d.daily.time.map((date,i) => ({
date, icon: wmoIcon(d.daily.weathercode[i]),
max: Math.round(d.daily.temperature_2m_max[i]),
min: Math.round(d.daily.temperature_2m_min[i]),
pop: d.daily.precipitation_probability_max[i] || 0,
}));
}

async function fetchWeatherbit() {
const r = await fetch(`https://api.weatherbit.io/v2.0/forecast/daily?lat=${LAT}&lon=${LON}&key=${WB_KEY}&days=10`);
const d = await r.json();
if(!d.data) throw new Error(‘no data’);
return d.data.map(x => ({
date: x.datetime, icon: wbIcon(x.weather.code),
max: Math.round(x.max_temp), min: Math.round(x.min_temp),
pop: Math.round(x.pop),
}));
}

async function fetchKMA() {
const base = getKMABase();
const B = ‘https://apis.data.go.kr/1360000/MidFcstInfoService’;
const [loRes, teRes] = await Promise.all([
fetch(`${B}/getMidLandFcst?serviceKey=${KMA_KEY}&numOfRows=10&pageNo=1&regId=11B00000&tmFc=${base}&dataType=JSON`),
fetch(`${B}/getMidTa?serviceKey=${KMA_KEY}&numOfRows=10&pageNo=1&regId=11H10501&tmFc=${base}&dataType=JSON`),
]);
const lo = await loRes.json();
const te = await teRes.json();
const li = lo.response?.body?.items?.item?.[0];
const ti = te.response?.body?.items?.item?.[0];
if(!li||!ti) throw new Error(‘KMA no response’);
const data = [];
for(let i=3;i<=10;i++){
const pop = Math.max(Number(li[‘rnSt’+i+‘Am’]||li[‘rnSt’+i]||0), Number(li[‘rnSt’+i+‘Pm’]||0));
const cond = li[‘wf’+i+‘Am’]||li[‘wf’+i]||’’;
data.push({ date:dateOffset(i), icon:kmaIcon(cond),
max: ti[‘taMax’+i]!=null?Math.round(ti[‘taMax’+i]):null,
min: ti[‘taMin’+i]!=null?Math.round(ti[‘taMin’+i]):null, pop });
}
return data;
}

async function fetchAccuWeather() {
const r = await fetch(‘https://www.accuweather.com/en/kr/seoul/226081/10-day-weather-forecast/226081’, {
headers: { ‘User-Agent’: UA }
});
const html = await r.text();
const m = html.match(/window.**PRELOADED_STATE**\s*=\s*({[\s\S]*?});\s*</script>/);
if(!m) throw new Error(‘parse failed’);
const st = JSON.parse(m[1]);
const fc = st?.forecast?.calendarContext?.forecasts?.dailyForecasts || st?.forecast?.daily?.periods || [];
return fc.slice(0,10).map((day,i) => {
const mxF = day.temperature?.maximum?.value;
const mnF = day.temperature?.minimum?.value;
return { date: day.date?day.date.split(‘T’)[0]:dateOffset(i+1), icon:accuIcon(day.day?.icon||day.icon),
max: mxF!=null?Math.round((mxF-32)*5/9):null,
min: mnF!=null?Math.round((mnF-32)*5/9):null,
pop: day.day?.precipitationProbability??0 };
});
}

async function fetchTimeAndDate() {
const r = await fetch(‘https://www.timeanddate.com/weather/south-korea/seoul/ext’, {
headers: { ‘User-Agent’: UA }
});
const html = await r.text();
const tm = html.match(/<table[^>]*id=“wt-ext”[^>]*>([\s\S]*?)</table>/);
if(!tm) throw new Error(‘table not found’);
const rows = tm[1].match(/<tr[^>]*>([\s\S]*?)</tr>/g)||[];
const data=[]; let idx=0;
for(const row of rows) {
if(idx>=10||!row.includes(’<td’)) continue;
const temps=[…row.matchAll(/>([-]?\d+)\s*°/g)].map(m=>parseInt(m[1]));
if(temps.length<1) continue;
const pm=row.match(/(\d+)\s*%/), tm2=row.match(/title=”([^”]+)”/);
data.push({ date:dateOffset(idx+1), icon:phraseIcon(tm2?tm2[1]:’’),
max:temps[0]??null, min:temps[1]??null, pop:pm?parseInt(pm[1]):0 });
idx++;
}
return data;
}

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=1800, stale-while-revalidate’);

const SOURCES = [
{ name: ‘Open-Meteo’,    color: ‘#34d399’, fn: fetchOpenMeteo    },
{ name: ‘Weatherbit’,    color: ‘#60a5fa’, fn: fetchWeatherbit    },
{ name: ‘KMA’,           color: ‘#f472b6’, fn: fetchKMA           },
{ name: ‘AccuWeather’,   color: ‘#fbbf24’, fn: fetchAccuWeather   },
{ name: ‘Time and Date’, color: ‘#a78bfa’, fn: fetchTimeAndDate   },
];

const results = await Promise.allSettled(SOURCES.map(s => s.fn()));

const sources = SOURCES.map((s, i) => ({
name:  s.name,
color: s.color,
data:  results[i].status === ‘fulfilled’ ? results[i].value : [],
error: results[i].status === ‘rejected’  ? results[i].reason?.message : null,
}));

res.json({ sources, updated: new Date().toISOString() });
}