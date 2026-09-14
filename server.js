const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');
const RATES_FILE = path.join(DATA_DIR, 'rates.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RATES_FILE)) fs.writeFileSync(RATES_FILE, '{}', 'utf8');

// Password is NOT stored in source code. This is a scrypt hash of the requested initial password.
const PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 'scrypt$16384$8$1$d95cadb5377340c29d2f47ed9f096364$1231ecf3e4a3f5f19c57c0133fb7858ba60e307e49931a31e7835148f8bf4da8';
// If ADMIN_PASSWORD_HASH is not supplied, run: node tools/create-password-hash.js
// The fallback above is intentionally invalid-looking and should be replaced before production.

const agents = [
  ['Multiwell','Kane','8 616 608 738 886','sales344@multiwell.net','www.multiwell.net',['Прямое Ж/Д','Авто','Море'],'Сборные груза'],
  ['Multiwell','Sakiya','8 619 860 070 462','sales242@multiwell.net','www.multiwell.net',['Прямое Ж/Д','Авто','Море'],'Сборные груза'],
  ['CR FREIGHT','Ирина Андреева','8 911 195 62 31','andreeva@crfreight.cn','',['Авиа'],'Опасный'],
  ['CR FREIGHT','Ella и другие','','cs19@crfreight.cn, ella@crfreight.cn, sr16@crfreight.cn','',['Авиа'],'Опасный'],
  ['TRANSIT, LLC','Konstantin Leonov','8 914 791 87 81','k.leonov@transitllc.ru','www.transitllc.ru',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России'],
  ['TRANSIT, LLC','Tatyana Iskaleeva','8 908 450 11 98','t.iskaleeva@transitllc.ru','www.transitllc.ru',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России'],
  ['TRANSIT, LLC','','','directrail@transitllc.ru','www.transitllc.ru',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России'],
  ['Русмарин','Евгений Ермоленко','8 921 401 61 29','evermolenko@rusmarine.ru','www.rusmarine.ru',['Прямое Ж/Д','Авто','Авиа','Море','Море + Ж/Д'],'Сборные груза'],
  ['Qtavia','Anastasiia Snatkina','86 131 499 21 667','a.snatkina@qtavia.com','https://qtavia.com/',['Авиа'],''],
  ['Qtavia','Linara Iliazova','8 936 131 23 25','linara.iliazova@qtavia.com','https://qtavia.com/',['Авиа'],''],
  ['Qtavia','Naida Azadova','8 986 749 55 92','naida.azadova@qtavia.com','https://qtavia.com/',['Авиа'],''],
  ['ФЛГ','Александр Токарев','8 906 238 85 17','sales@flgrussia.com','https://flgrussia.com/',['Прямое Ж/Д','Авто'],'Сборные груза'],
  ['РусКарго','Alina Karpova','8 981 930 24 66','kas@r-cargo.com','https://r-cargo.com/',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],''],
  ['YM Trans Group','Милена Никитина','8 925 988 65 99','982@ymtrans.ru','www.ymtrans.ru',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],''],
  ['JENTY','Marina Kostukovich','375 29 192 46 69','m.kostukovich@jenty-spedition.com','https://jenty-spedition.ru/',['Авто'],'Сборные груза'],
  ['Consolidator-DV LLC','Timofei Bakanovich','8 964 432 57 95','import5@consolidator-dv.ru','http://consolidator-dv.ru/',['Море'],'Сборные груза'],
  ['ТАМГА','Осипов Николай','8 985 279 69 39','n.osipov@tamga80.ru','https://tamga80.ru/ru',['Авто'],'Сборные груза, Негабарит'],
  ['Green Avia','Kuzmina Maria','8 936 506 11 15','sales3@avia-dostavka.com','https://avia-dostavka.com/',['Авиа'],''],
  ['Sky Cargo Service','Ekaterina Ivanova','8 913 061 71 56','sales10@scs-aero.ru','www.scs-aero.ru',['Авиа'],''],
  ['Альфа Транзит','Щепина Виктория','8 916 894 05 20','v.shchepina@alfa-transit.com','www.alfa-transit.com',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России, Негабарит, Опасный'],
  ['Шатл Логистик / Shuttle-Logistic','Братасенко Михаил','8 999 614 64 92','mb@shuttle-logistic.ru','www.shuttle-logistic.ru',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России, Негабарит, Опасный'],
  ['Chengdu Tiechi Silk Road Supply Chain Management','Lily','8 619 115 959 752','lily@tsrscm.com','http://tsrscm.com/ru/',['Прямое Ж/Д'],'Сборные груза'],
  ['GUANGZHOU ETY TRANS INTERNATIONAL FREIGHT FORWARDING','Vera Yao','8 615 999 941 607','vera@cnetytrans.com','www.cnetytrans.com',['Прямое Ж/Д','Море','Море + Ж/Д'],''],
  ['A2','Микулин Владимир','8 913 061 71 56','v.mikulin@a2-express.com','a2-express.com',['Авиа'],''],
  ['RUTENSIL Logistics','Алина','8 906 351 17 33','108@rutensil.com','http://rutensil.com/',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Европа'],
  ['ВТХ','Станислав','8 914 077 79 26','vthopr4@vostoktransholding.ru','http://vostoktransholding.ru/',['Море','Море + Ж/Д'],'Сборные груза, США, Европа'],
  ['ВТХ','Алексей','8 914 704 43 41','sales4@vostoktransholding.ru','http://vostoktransholding.ru/',['Море','Море + Ж/Д'],'Сборные груза, США, Европа'],
  ['Chongqing Gudali Supply Chain Management','Logan','8 613 827 428 296','logan@gdl-rail.com','logan@gdl-rail.com',['Прямое Ж/Д','Авто'],'Сборные груза'],
  ['Вэй Трейд','Рукосуева Евгения Олеговна','8 902 981 11 04','e.rukosueva@way-trade.ru','https://way-trade.ru/',['Прямое Ж/Д','Авто','Море + Ж/Д'],''],
  ['WAY GROUP','Общий','8 800 600 04 30','info@wayg.ru','https://www.wayg.ru/',['Прямое Ж/Д','Авто','Море','Море + Ж/Д'],'Сборные груза, Негабарит'],
  ['ФИТ, Владивосток','Маргарита','8-800-23-444-99 ext. 41501; +7-914-794-20-89','NNKuznetsova@fesco.com','https://www.fesco.ru/ru/',['Прямое Ж/Д','Море','Море + Ж/Д'],'Сборные груза, Ж/Д по России, Негабарит'],
  ['Нью Вэй Лоджистик','Боев Сергей','8 914 320 65 95','310@newwaylogistic.ru','https://newwaylogistic.ru/',['Море','Море + Ж/Д'],'Ж/Д по России, Опасный'],
  ['ВЕЛЕС','Венера Рашидова','8 918 418 69 82','operative2@velesforwarding.ru','www.velesforwarding.ru',['Море'],'Новороссийск, Негабарит, Опасный'],
  ['ГАЛЕАС','Роман','8 961 520 31 25','r.kuznetsov@galeasgroup.ru','https://galeasgroup.ru/',['Море'],'Новороссийск'],
  ['Znylogistics','Maya','','operator01@znylogistics.com','',['Авто'],'Турция'],
  ['РТТК','Алексей Веслополов (Чита)','8 3022 21 18 18; 8 914 464 23 32','rttk888@mail.ru','https://www.rttk.net/',['Ж/Д','Авто'],'Негабарит, Россия, Китай'],
  ['Tu-Tell','Вадим','375 33 3071468','t14@tutell.com','https://www.tutell.com/',['Авто'],'Сборные груза, Турция, Европа'],
  ['СДЕК','Палащук Владислав Сергеевич','8 924 697 72 73','v.palashchuk@cdek.ru','www.cdek.ru',['Мелкие груза'],'Китай'],
  ['ИП Полчанинов Кирилл Александрович','Кирилл','7 925 991 25 75','pka666@yandex.ru','',['Автовывоз с СВХ, машина 42-43 куб.м.'],'Россия, Москва, МО'],
  ['ИП Диана Куркина','Евгений','7 962 936 27 08','yevgeniy-kurkin@mail.ru','',['Автовывоз с СВХ, машина до 18 куб.м.'],'Россия, Москва, МО'],
  ['','Алексей','7 985 227 06 67','','',['Автовывоз с СВХ, более 20 куб.м.'],'Россия, Москва, МО']
].map((a, i) => ({ id: `${slug(a[0] || 'agent')}-${i+1}`, name:a[0], contact:a[1], phone:a[2], email:a[3], site:a[4], transport:a[5], notes:a[6] }));

function slug(s){ return String(s).toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,40) || 'agent'; }

function readRates(){ try { return JSON.parse(fs.readFileSync(RATES_FILE,'utf8')); } catch { return {}; } }
function writeRates(data){ const tmp=RATES_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(data,null,2),'utf8'); fs.renameSync(tmp,RATES_FILE); }

function timingSafe(a,b){ const aa=Buffer.from(a); const bb=Buffer.from(b); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function verifyPassword(password){
  const parts = String(PASSWORD_HASH).split('$');
  if(parts[0] !== 'scrypt' || parts.length !== 7) return false;
  const [,N,r,p,salt,hash] = parts;
  try { const derived=crypto.scryptSync(password,salt,Buffer.from(hash,'hex').length,{N:Number(N),r:Number(r),p:Number(p)}).toString('hex'); return timingSafe(derived,hash); } catch { return false; }
}
function sign(payload){ return crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('base64url'); }
function makeToken(){ const body=Buffer.from(JSON.stringify({exp:Date.now()+8*60*60*1000})).toString('base64url'); return body+'.'+sign(body); }
function auth(req,res,next){
  const token=req.cookies?.auth;
  if(!token) return res.status(401).json({error:'Требуется вход'});
  const [body,sig]=token.split('.');
  if(!body || !sig || !timingSafe(sign(body),sig)) return res.status(401).json({error:'Недействительная сессия'});
  try { const data=JSON.parse(Buffer.from(body,'base64url').toString()); if(data.exp<Date.now()) throw new Error(); req.user={admin:true}; next(); } catch { res.status(401).json({error:'Сессия истекла'}); }
}

app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],scriptSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"]}}}));
app.use(express.json({limit:'50kb'}));
app.use(require('cookie-parser')());
app.use('/api/login', rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false}));

app.post('/api/login',(req,res)=>{
  const password=typeof req.body?.password==='string'?req.body.password:'';
  if(!verifyPassword(password)) return res.status(401).json({error:'Неверный пароль'});
  res.cookie('auth',makeToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*60*60*1000,path:'/'});
  res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{res.clearCookie('auth',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'});res.json({ok:true});});
app.get('/api/me',(req,res)=>{try{auth(req,res,()=>res.json({authenticated:true}));}catch{res.json({authenticated:false});}});
app.get('/api/agents',auth,(req,res)=>res.json(agents));
app.get('/api/rates',auth,(req,res)=>res.json(readRates()));
app.post('/api/rates',auth,(req,res)=>{
  const {agentId,text}=req.body||{};
  if(typeof agentId!=='string'||typeof text!=='string'||text.length>3000) return res.status(400).json({error:'Некорректная ставка'});
  if(!agents.some(a=>a.id===agentId)) return res.status(404).json({error:'Агент не найден'});
  const rates=readRates(); rates[agentId]={text:text.trim().slice(0,3000),updatedAt:new Date().toISOString()}; writeRates(rates); res.json({ok:true});
});
app.delete('/api/rates/:id',auth,(req,res)=>{const rates=readRates();delete rates[req.params.id];writeRates(rates);res.json({ok:true});});
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.use((req,res)=>res.status(404).send('Not found'));
app.listen(PORT,()=>console.log(`Logistics app: http://localhost:${PORT}`));
