import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTBOX = process.env.EC_OUTBOX_DIR || path.join(__dirname, '..', 'data', 'outbox')

async function enviarCorreo({ para, asunto, html, texto }) {
  const host = process.env.SMTP_HOST
  try {
    if (host) {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === '1',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      })
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Electro Cuciné" <no-reply@electrocucine.com>',
        to: para,
        subject: asunto,
        html,
        text: texto
      })
      return { enviado: true, via: 'smtp' }
    }
    fs.mkdirSync(OUTBOX, { recursive: true })
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    fs.writeFileSync(
      path.join(OUTBOX, nombre),
      JSON.stringify({ para, asunto, texto, html, fecha: new Date().toISOString() }, null, 2)
    )
    console.log(`[correo] sin SMTP configurado; escrito en ${OUTBOX}/${nombre}`)
    return { enviado: true, via: 'outbox' }
  } catch (error) {
    console.error('[correo] No se pudo enviar:', error?.message)
    return { enviado: false, via: 'error', error: error?.message }
  }
}

function htmlCompra(venta, usuario, correo) {
  const filas = venta.items
    .map(
      (i) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eef1f6;">${i.cantidad}× ${i.nombre}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eef1f6;text-align:right;white-space:nowrap;">$${(i.precio * i.cantidad).toLocaleString('es-AR')}</td>
      </tr>`
    )
    .join('')

  const descuento =
    venta.descuento_pct > 0
      ? `<tr><td style="padding:6px 10px;color:#00a650;">Descuento ${venta.descuento_pct}% (65+)</td><td style="padding:6px 10px;text-align:right;color:#00a650;">- $${Number(venta.descuento_monto).toLocaleString('es-AR')}</td></tr>`
      : ''

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif;color:#16233c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;">
    <tr><td style="background:#0a2354;padding:20px 24px;"><span style="color:#ffffff;font-size:20px;font-weight:800;">Electro <strong style="color:#7fb3f5;">Cuciné</strong></span></td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">¡Gracias por tu compra${usuario?.nombre ? `, ${usuario.nombre.split(' ')[0]}` : ''}!</h1>
      <p style="margin:0 0 16px;color:#64738c;">Tu pedido <strong>#${venta.id}</strong> fue registrado el ${venta.fecha}.</p>
      <p style="margin:0 0 6px;"><strong>Enviando a:</strong> ${venta.direccion_envio || 'A coordinar con el vendedor'}</p>
      <p style="margin:0 0 16px;"><strong>Entrega estimada:</strong> 24–48 h hábiles</p>
      <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eef1f6;border-radius:8px;border-collapse:separate;border-spacing:0;margin-bottom:12px;">${filas}</table>
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="padding:4px 10px;color:#64738c;">Subtotal</td><td style="padding:4px 10px;text-align:right;color:#64738c;">$${Number(venta.subtotal).toLocaleString('es-AR')}</td></tr>
        ${descuento}
        <tr><td style="padding:8px 10px;font-size:17px;font-weight:800;">Total pagado</td><td style="padding:8px 10px;text-align:right;font-size:17px;font-weight:800;">$${Number(venta.total).toLocaleString('es-AR')}</td></tr>
      </table>
      <p style="margin:16px 0 0;color:#64738c;font-size:13px;">Podés ver el estado de tu pedido en cualquier momento ingresando a <strong>Mis compras</strong> en Electro Cuciné.</p>
    </td></tr>
    <tr><td style="background:#f7f8fb;padding:14px 24px;font-size:12px;color:#64738c;border-top:1px solid #eef1f6;">Electro Cuciné · Av. Siempreviva 742 · 0800-123-4567 · ayuda@electrocucine.com<br/>Este correo fue enviado a ${correo}. Si no hiciste esta compra, contactanos.</td></tr>
  </table>
</body></html>`
}

function textoCompra(venta, usuario, correo) {
  const lineas = venta.items.map((i) => `- ${i.cantidad}× ${i.nombre}: $${(i.precio * i.cantidad).toLocaleString('es-AR')}`).join('\n')
  return [
    `¡Gracias por tu compra${usuario?.nombre ? `, ${usuario.nombre.split(' ')[0]}` : ''}!`,
    `Tu pedido #${venta.id} fue registrado el ${venta.fecha}.`,
    `Envío a: ${venta.direccion_envio || 'A coordinar con el vendedor'}`,
    'Entrega estimada: 24–48 h hábiles',
    '',
    'Detalle:',
    lineas,
    '',
    `Subtotal: $${Number(venta.subtotal).toLocaleString('es-AR')}`,
    venta.descuento_pct > 0 ? `Descuento ${venta.descuento_pct}%: - $${Number(venta.descuento_monto).toLocaleString('es-AR')}` : null,
    `Total pagado: $${Number(venta.total).toLocaleString('es-AR')}`,
    '',
    `Enviado a ${correo}. Podés ver tu pedido en "Mis compras".`
  ]
    .filter(Boolean)
    .join('\n')
}

export async function enviarConfirmacionCompra(venta, usuario, correo) {
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    return { enviado: false, via: 'sin-correo' }
  }
  const asunto = `¡Gracias por tu compra! Pedido #${venta.id} — Electro Cuciné`
  return enviarCorreo({ para: correo, asunto, html: htmlCompra(venta, usuario, correo), texto: textoCompra(venta, usuario, correo) })
}

function marcoBase(contenidoHtml, pieExtra = '') {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f2ec;font-family:Arial,Helvetica,sans-serif;color:#26201b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;">
    <tr><td style="background:#171310;padding:18px 24px;"><span style="color:#f6f2ec;font-size:20px;font-weight:800;">Electro <strong style="color:#f2542d;">Cuciné</strong></span></td></tr>
    <tr><td style="padding:24px;">${contenidoHtml}</td></tr>
    <tr><td style="background:#f4efe6;padding:14px 24px;font-size:12px;color:#6e645a;border-top:1px solid #eee;">Electro Cuciné · Av. Siempreviva 742 · 0800-123-4567 · ayuda@electrocucine.com${pieExtra ? '<br/>' + pieExtra : ''}</td></tr>
  </table>
</body></html>`
}

export async function enviarAvisoClienteStock(producto, correo) {
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return { enviado: false, via: 'sin-correo' }
  const base = process.env.SITE_URL || 'http://localhost:3001'
  const contenido = `
    <h1 style="margin:0 0 6px;font-size:22px;">¡Volvió el stock!</h1>
    <p style="margin:0 0 16px;color:#6e645a;">El producto que tenías en la mira ya está disponible otra vez:</p>
    <p style="margin:0 0 4px;font-size:16px;font-weight:800;">${producto.nombre}</p>
    <p style="margin:0 0 16px;color:#6e645a;">Precio: $${Number(producto.precio).toLocaleString('es-AR')} — Stock: ${producto.stock} unidades</p>
    <a href="${base}/producto/${producto.id}" style="display:inline-block;background:#f2542d;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px;">Ver el producto</a>`
  const texto = `¡Volvió el stock!\n${producto.nombre} — $${Number(producto.precio).toLocaleString('es-AR')} — Stock: ${producto.stock} unidades\n${base}/producto/${producto.id}`
  return enviarCorreo({ para: correo, asunto: `¡Volvió ${producto.nombre}! — Electro Cuciné`, html: marcoBase(contenido), texto })
}

export async function enviarAvisoPocoStockAdmin(producto, stockActual, ventaId) {
  const destinatario = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER
  if (!destinatario) return { enviado: false, via: 'sin-admin-email' }
  const contenido = `
    <h1 style="margin:0 0 6px;font-size:20px;">Poco stock: ${producto.nombre}</h1>
    <p style="margin:0 0 12px;color:#6e645a;">Tras la venta <strong>#${ventaId}</strong>, el producto quedó con <strong>${stockActual}</strong> ${stockActual === 1 ? 'unidad' : 'unidades'}.</p>
    <p style="margin:0;">Podés reponerlo desde el panel del superusuario (Productos y stock).</p>`
  const texto = `Poco stock: ${producto.nombre}\nQuedan ${stockActual} unidades tras la venta #${ventaId}.`
  return enviarCorreo({ para: destinatario, asunto: `[Poco stock] ${producto.nombre} (${stockActual} u.) — Electro Cuciné`, html: marcoBase(contenido), texto })
}

export async function enviarEstadoPedido(venta, usuario, estadoNuevo) {
  const correo = usuario?.email
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return { enviado: false, via: 'sin-correo' }
  const estados = {
    en_camino: {
      titulo: 'Tu pedido está en camino',
      color: '#0ea5e9',
      texto: `Tu pedido <strong>#${venta.id}</strong> ya está en camino al domicilio: ${venta.direccion_envio || '(sin dirección cargada)'}.`,
      asunto: `Pedido #${venta.id} en camino — Electro Cuciné`
    },
    entregado: {
      titulo: '¡Tu pedido fue entregado!',
      color: '#00a650',
      texto: `Tu pedido <strong>#${venta.id}</strong> fue entregado. Esperamos que disfrutes tu compra.`,
      asunto: `Pedido #${venta.id} entregado — Electro Cuciné`
    }
  }
  const info = estados[estadoNuevo]
  if (!info) return { enviado: false, via: 'estado-desconocido' }
  const contenido = `
    <h1 style="margin:0 0 6px;font-size:22px;color:${info.color};">${info.titulo}</h1>
    <p style="margin:0 0 12px;color:#6e645a;">${info.texto}</p>
    <p style="margin:0;color:#6e645a;font-size:13px;">Podés ver el estado de tu pedido en cualquier momento ingresando a <strong>Mis compras</strong>.</p>`
  const texto = `${info.titulo}\n${info.texto.replace(/<[^>]+>/g, '')}`
  return enviarCorreo({ para: correo, asunto: info.asunto, html: marcoBase(contenido), texto })
}
