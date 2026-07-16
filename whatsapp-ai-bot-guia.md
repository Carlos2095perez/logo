# Cómo crear un bot de WhatsApp Business que responde con IA (gratis y sin programar)

Esta guía arma un "agente" que contesta automáticamente los mensajes de tu WhatsApp Business usando inteligencia artificial, con herramientas gratuitas y sin escribir código. Se arman 3 piezas y se conectan entre sí:

1. **Meta WhatsApp Cloud API** → el canal oficial y gratuito para conectar WhatsApp a herramientas externas.
2. **n8n** → la herramienta "no-code" (arrastrar y soltar bloques) que conecta todo.
3. **Google Gemini (IA)** → el "cerebro" que redacta las respuestas, con capa gratuita sin tarjeta de crédito.

## Paso 1 — Activar el canal oficial de WhatsApp (gratis)

1. Entrá a https://developers.facebook.com y creá una cuenta de desarrollador (con tu Facebook normal).
2. Creá una App nueva → tipo **"Business"**.
3. Dentro de la App, agregá el producto **WhatsApp**.
4. Meta te da automáticamente:
   - Un **número de prueba gratuito** para probar el bot ya mismo.
   - Un **Phone Number ID**, un **WhatsApp Business Account ID** y un **Access Token** temporal.
5. Guardá esos 3 datos, los vas a necesitar en el paso 3.

⚠️ **Importante sobre tu número real**: mientras probás, usá el número de prueba que te da Meta (podés agregar tu propio celular como "destinatario de prueba" sin costo). Recién cuando el bot funcione bien, migrás tu número real de WhatsApp Business a la API. Meta tiene una función llamada **"coexistencia"** que permite seguir usando la app de WhatsApp Business normalmente en el celular Y tener el bot respondiendo por API al mismo tiempo — conviene activarla para no perder el uso manual de la app.

## Paso 2 — Crear tu cuenta gratis en n8n

1. Entrá a https://n8n.io y creá una cuenta (n8n Cloud tiene prueba gratuita y después un plan gratuito limitado, suficiente para un negocio chico).
2. Si más adelante querés que sea 100% gratis para siempre, se puede auto-hospedar (por ejemplo en Railway o Render, planes free) — no es necesario para empezar.
3. Creá un **workflow nuevo** (vacío).

## Paso 3 — Conectar WhatsApp con n8n

1. Agregá un nodo **"WhatsApp Trigger"** (buscalo en el buscador de nodos de n8n).
2. Creá una credencial nueva pegando el **Phone Number ID** y el **Access Token** del Paso 1.
3. n8n te va a mostrar una **URL de webhook**. Copiala.
4. Volvé a la App de Meta (Paso 1) → configuración de WhatsApp → Webhooks → pegá esa URL y el "Verify Token" que te pida n8n.
5. Suscribite al evento **"messages"**.

Con esto, cada mensaje que le llegue a tu número de prueba va a "entrar" a n8n.

## Paso 4 — Agregar la Inteligencia Artificial

1. Entrá a https://aistudio.google.com/apikey y generá una **API Key gratis de Google Gemini** (no pide tarjeta).
2. En n8n, agregá el nodo **"Google Gemini"** (o el nodo genérico de IA / AI Agent) después del WhatsApp Trigger.
3. Pegá tu API Key.
4. En el campo de instrucciones (prompt), escribí algo como:
   > "Sos el asistente de [nombre de tu negocio]. Respondé de forma breve, amable y clara a las consultas de clientes por WhatsApp."
5. Conectá el **texto del mensaje entrante** (que viene del nodo WhatsApp Trigger) como la pregunta que recibe la IA.

## Paso 5 — Responder al cliente

1. Agregá un nodo **"WhatsApp"** (de envío) al final.
2. Configurá:
   - **Destinatario**: el número del cliente (viene automáticamente del nodo Trigger).
   - **Mensaje**: la respuesta generada por el nodo de IA.
3. Conectá los nodos en este orden:

   `WhatsApp Trigger → Google Gemini → WhatsApp (enviar)`

4. Activá el workflow (interruptor **"Active"** arriba a la derecha).

## Paso 6 — Probar

Mandale un WhatsApp al número de prueba desde tu celular personal (agregado como destinatario de prueba en el Paso 1) y confirmá que el bot responde solo.

## Costos

- **WhatsApp Cloud API**: gratis (Meta da miles de conversaciones gratis por mes; para un negocio chico normalmente no se paga nada).
- **Google Gemini**: capa gratuita con límite de mensajes por minuto, más que suficiente para empezar.
- **n8n**: gratis en self-host, o plan gratuito limitado en la nube.

## Alternativa aún más simple (menos flexible)

Si esto te parece con muchos pasos, la app de **WhatsApp Business** (la que ya tenés en el celular) trae gratis y sin nada de esto:
- **Mensaje de bienvenida**
- **Mensaje de ausencia**
- **Respuestas rápidas**

Se configuran desde Ajustes → Herramientas para la Empresa, en 2 minutos, pero solo dan respuestas fijas (no conversación con IA real).
