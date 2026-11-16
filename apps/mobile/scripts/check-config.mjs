// Teste de configuração da casca Android (Node puro, sem dependências).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const falhas = [];
let total = 0;

function checar(ok, mensagem) {
  total += 1;
  if (!ok) falhas.push(mensagem);
}

export function checkIfExists(caminho) {
  const ok = existsSync(join(raiz, caminho));
  checar(ok, `Arquivo ausente: ${caminho}`);
  return ok;
}

function ler(caminho) {
  return existsSync(join(raiz, caminho)) ? readFileSync(join(raiz, caminho), 'utf8') : '';
}

function contem(caminho, trecho) {
  checar(ler(caminho).includes(trecho), `${caminho} deveria conter: ${trecho}`);
}

function naoContem(caminho, trecho) {
  checar(!ler(caminho).includes(trecho), `${caminho} não deveria conter: ${trecho}`);
}

// capacitor.config.ts
const cfg = 'capacitor.config.ts';
for (const t of [
  "appId: 'br.com.gestorbeauty.app'",
  "appName: 'Gestor Beauty'",
  "'https://sgs.jessicaseixasmakeup.com.br'",
  "errorPath: 'offline.html'",
  'allowMixedContent: false',
  'launchAutoHide: true',
]) contem(cfg, t);
naoContem(cfg, 'cleartext');
naoContem(cfg, 'http://');

// www
checkIfExists('www/index.html');
checkIfExists('www/offline.html');
for (const t of ['Sem conexão', 'Tentar novamente', 'https://sgs.jessicaseixasmakeup.com.br/'])
  contem('www/offline.html', t);
naoContem('www/offline.html', 'Capacitor');

// Paridade de versões com o frontend (Pitfall 2)
const frontend = JSON.parse(readFileSync(join(raiz, '..', 'frontend', 'package.json'), 'utf8'));
const mobile = JSON.parse(ler('package.json'));
const depsMobile = { ...mobile.dependencies, ...mobile.devDependencies };
for (const [nome, versao] of Object.entries(frontend.dependencies ?? {})) {
  if (!nome.startsWith('@capacitor/')) continue;
  checar(
    depsMobile[nome] === versao,
    `Versão de ${nome} difere: frontend ${versao}, mobile ${depsMobile[nome]}`,
  );
}
for (const [nome, versao] of Object.entries(depsMobile)) {
  if (!nome.startsWith('@capacitor/')) continue;
  checar(!/^[\^~]/.test(versao), `${nome} precisa de versão exata (sem ^ ou ~): ${versao}`);
}

// Projeto Android
const gradle = 'android/app/build.gradle';
contem(gradle, 'applicationId "br.com.gestorbeauty.app"');
contem(gradle, 'ANDROID_KEYSTORE_PATH');
contem(gradle, "findProperty('versionCode')");
contem('android/variables.gradle', 'targetSdkVersion = 36');
contem('android/variables.gradle', 'minSdkVersion = 24');
const manifesto = ler('android/app/src/main/AndroidManifest.xml');
checar(
  /default_notification_channel_id"\s+android:value="agenda"/.test(manifesto),
  'AndroidManifest.xml deveria definir default_notification_channel_id = agenda',
);
contem('android/app/src/main/res/values/strings.xml', '>Gestor Beauty<');
checkIfExists('android/app/src/main/res/drawable/ic_stat_gestor_beauty.xml');
contem('android/app/src/main/res/values/styles.xml', 'windowSplashScreenBackground');

// Nenhum segredo versionado
let rastreados = '';
try {
  rastreados = execSync('git ls-files .', { cwd: raiz, encoding: 'utf8' });
} catch {
  rastreados = '';
}
checar(
  !/\.jks$|\.keystore$|google-services\.json$/m.test(rastreados),
  'Há keystore ou google-services.json versionado em apps/mobile',
);

if (falhas.length) {
  console.error(`check-config: ${falhas.length} falha(s) em ${total} verificações`);
  for (const f of falhas) console.error(` - ${f}`);
  process.exit(1);
}
console.log(`check-config: OK (${total} verificações)`);
