# Guia de Pruebas — Webhook de Provisioning y Notificaciones Slack

## Parte A: Configurar Slack Incoming Webhooks (2 minutos)

### Paso 1: Crear una Slack App
1. Ve a [https://api.slack.com/apps](https://api.slack.com/apps)
2. Haz clic en **"Create New App"**
3. Selecciona **"From scratch"**
4. Nombre: `Onboarding OS Alerts`
5. Selecciona tu workspace y haz clic en **"Create App"**

### Paso 2: Activar Incoming Webhooks
1. En el menu lateral, haz clic en **"Incoming Webhooks"**
2. Activa el toggle **"Activate Incoming Webhooks"** (ON)
3. Haz clic en **"Add New Webhook to Workspace"** (abajo de la pagina)
4. Selecciona el canal donde quieres recibir alertas (ej: `#onboarding-alertas`)
5. Haz clic en **"Allow"**

### Paso 3: Copiar la URL del Webhook
1. Copia la URL que aparece (formato: `https://hooks.slack.com/services/T.../B.../xxx`)
2. Agregala a tu archivo `.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TU_URL_AQUI
```

3. Reinicia el servidor de desarrollo (`npm run dev`)

---

## Parte B: Probar el Webhook de Provisioning

### Variables de entorno necesarias

Agrega estas variables a tu archivo `.env`:

```bash
# Token secreto para autenticar llamadas al webhook
WEBHOOK_SECRET=mi-token-secreto-de-prueba

# URL del webhook de Slack (opcional para desarrollo)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TU_URL_AQUI
```

### Opcion 1: Snippet para VS Code REST Client (archivo .http)

Crea un archivo `test-webhook.http` en la raiz del proyecto:

```http
### Provisioning Webhook — Identity Flip
POST http://localhost:3000/api/webhooks/provisioning
Authorization: Bearer mi-token-secreto-de-prueba
Content-Type: application/json

{
  "userId": "REEMPLAZAR_CON_UUID_REAL",
  "corporateEmail": "josmar.rodriguez@farmatodo.com"
}

### Provisioning Webhook — Token invalido (debe retornar 401)
POST http://localhost:3000/api/webhooks/provisioning
Authorization: Bearer token-incorrecto
Content-Type: application/json

{
  "userId": "cualquier-uuid",
  "corporateEmail": "test@farmatodo.com"
}

### Provisioning Webhook — Payload invalido (debe retornar 400)
POST http://localhost:3000/api/webhooks/provisioning
Authorization: Bearer mi-token-secreto-de-prueba
Content-Type: application/json

{
  "userId": "no-es-un-uuid",
  "corporateEmail": "no-es-un-email"
}
```

### Opcion 2: Comando curl para iTerm/Terminal

**Paso 1:** Obtener el UUID del usuario Josmar desde la base de datos:

```bash
# Consultar la DB directamente
npx prisma studio
# Busca el usuario "Josmar Rodriguez" y copia su ID (UUID)
```

**Paso 2:** Ejecutar el curl (reemplaza `TU_USER_ID` con el UUID real):

```bash
# Llamada exitosa
curl -X POST http://localhost:3000/api/webhooks/provisioning \
  -H "Authorization: Bearer mi-token-secreto-de-prueba" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TU_USER_ID",
    "corporateEmail": "josmar.rodriguez@farmatodo.com"
  }'
```

```bash
# Probar autenticacion fallida (debe retornar 401)
curl -X POST http://localhost:3000/api/webhooks/provisioning \
  -H "Authorization: Bearer token-incorrecto" \
  -H "Content-Type: application/json" \
  -d '{"userId": "cualquier-id", "corporateEmail": "test@test.com"}'
```

### Respuesta esperada (exito):

```json
{
  "success": true,
  "journeyId": "uuid-del-journey",
  "newProgress": 40,
  "unlockedSteps": 3
}
```

### Respuesta esperada (token invalido):

```json
{
  "error": "Unauthorized"
}
```

---

## Parte C: Probar el Boton de Nudge

1. Asegurate de que la DB tenga datos frescos: `npm run db:seed` (requiere reset previo)
2. Abre `http://localhost:3000/dashboard`
3. El usuario Josmar tiene el paso 2 ("Creacion de identidad corporativa") en estado `PENDING`
4. Deberia aparecer un boton: **"¿Tarda mucho? Notificar a TI"**
5. Al hacer clic, se envia la notificacion a Slack y el boton cambia a **"TI Notificado (espera 4h)"**
6. Durante las siguientes 4 horas, el boton permanece deshabilitado (cooldown de base de datos)
7. Revisa la consola del servidor para ver los logs de la notificacion
