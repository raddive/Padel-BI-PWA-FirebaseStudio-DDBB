# Padel BI

Contador y estadísticas de partidos de pádel. PWA con Next.js y Firestore.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Rellena .env.local con las credenciales de tu proyecto Firebase
npm run dev
```

Abre [http://localhost:9002](http://localhost:9002).

## Firebase (proyecto nuevo)

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Activa **Firestore** (modo producción; las reglas del repo permiten lectura/escritura abierta, válido solo para uso personal)
3. Añade una app **Web** y copia la config a `.env.local`
4. Instala Firebase CLI si no la tienes: `npm install -g firebase-tools`
5. Inicia sesión: `firebase login`
6. Enlaza el proyecto: `firebase use --add` (elige tu proyecto y un alias, p. ej. `default`)

## Despliegue

```bash
npm run deploy
```

Publica el build estático (`out/`) en **Firebase Hosting** y despliega las reglas de Firestore.

Solo hosting o solo reglas:

```bash
npm run deploy:hosting
npm run deploy:rules
```

## PWA

Tras desplegar, abre la URL de Firebase Hosting en Chrome/Edge y usa **Instalar app** / **Añadir a pantalla de inicio**.

## Datos

Al terminar un partido, el resultado se guarda automáticamente en la colección `matches` de Firestore.
