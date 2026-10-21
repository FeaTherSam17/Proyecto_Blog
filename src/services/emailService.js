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
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

async function enviarVerificacionEmail({ destinatario, nombre, token }) {
    const transporter = crearTransporter();
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        throw new Error('Falta la variable FRONTEND_URL');
    }

    // El token se envia una sola vez por HTTPS y tiene una vigencia limitada
    // en la base de datos; el servidor nunca guarda su valor original.
    const enlace = `${frontendUrl.replace(/\/$/, '')}/verificar-correo?token=${encodeURIComponent(token)}`;
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: destinatario,
        subject: 'Verifica tu correo para activar tu cuenta de autor',
        text: [
            `Hola ${nombre},`,
            '',
            'Confirma que controlas este correo abriendo el siguiente enlace:',
            enlace,
            '',
            'El enlace expira en 30 minutos y solo puede utilizarse una vez.'
        ].join('\n'),
        html: `<p>Hola ${nombre},</p><p>Confirma que controlas este correo abriendo el siguiente enlace:</p><p><a href="${enlace}">Verificar correo</a></p><p>El enlace expira en 30 minutos y solo puede utilizarse una vez.</p>`
    });
}

module.exports = { enviarVerificacionEmail };
