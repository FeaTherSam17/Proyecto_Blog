const nodemailer = require('nodemailer');

function crearTransporter() {
    // SMTP se configura mediante secretos del entorno para no exponer
    // credenciales del proveedor de correo en el repositorio.
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Faltan variables SMTP: ${missing.join(', ')}`);
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        // Evita que una conexion SMTP bloqueada deje el registro
        // indefinidamente en estado "REGISTRANDO...".
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obtenerContenidoEmail({ destinatario, nombre, enlace }) {
    const nombreSeguro = escaparHtml(nombre);
    return {
        sender: {
            name: process.env.BREVO_SENDER_NAME || 'TAD Blog',
            email: process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM
        },
        to: [{ email: destinatario }],
        subject: 'Verifica tu correo para activar tu cuenta de autor',
        textContent: [
            `Hola ${nombre},`,
            '',
            'Confirma que controlas este correo abriendo el siguiente enlace:',
            enlace,
            '',
            'El enlace expira en 30 minutos y solo puede utilizarse una vez.'
        ].join('\n'),
        htmlContent: `<p>Hola ${nombreSeguro},</p><p>Confirma que controlas este correo abriendo el siguiente enlace:</p><p><a href="${enlace}">Verificar correo</a></p><p>El enlace expira en 30 minutos y solo puede utilizarse una vez.</p>`
    };
}

async function enviarPorBrevoApi(email) {
    if (!process.env.BREVO_API_KEY) {
        return false;
    }

    // La API usa HTTPS (443), que suele estar permitido aunque el SMTP
    // saliente esté bloqueado por la plataforma de despliegue.
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
        },
        body: JSON.stringify(email),
        signal: AbortSignal.timeout(15000)
    });

    if (!respuesta.ok) {
        const detalle = await respuesta.text();
        throw new Error(`Brevo API HTTP ${respuesta.status}: ${detalle.slice(0, 500)}`);
    }
    return true;
}

async function enviarVerificacionEmail({ destinatario, nombre, token }) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        throw new Error('Falta la variable FRONTEND_URL');
    }

    // El token se envia una sola vez por HTTPS y tiene una vigencia limitada
    // en la base de datos; el servidor nunca guarda su valor original.
    const enlace = `${frontendUrl.replace(/\/$/, '')}/verificar-correo?token=${encodeURIComponent(token)}`;
    const email = obtenerContenidoEmail({ destinatario, nombre, enlace });

    // Se prefiere la API HTTPS de Brevo porque Render puede bloquear
    // conexiones SMTP salientes. Si no hay API key, se conserva SMTP.
    if (await enviarPorBrevoApi(email)) {
        return;
    }

    const transporter = crearTransporter();
    try {
        await transporter.sendMail({
            from: email.sender.email,
            to: destinatario,
            subject: email.subject,
            text: email.textContent,
            html: email.htmlContent
        });
    } finally {
        transporter.close();
    }
}

module.exports = { enviarVerificacionEmail };
