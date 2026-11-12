// Mascota de Electro Cuciné: una taza de café con carita que acompaña
// las páginas de error mostrando el código (404, 500, etc.).
// El prop "estado" cambia la expresión: neutra | duda | triste | seria.
export default function TazaMascota({ codigo, estado = 'neutra', size = 240 }) {
  // Boca y cejas según el estado de ánimo.
  const bocas = {
    neutra: 'M108 87 q12 9 24 0',
    duda: 'M112 88 a5 5 0 1 0 16 0 a5 5 0 1 0 -16 0',
    triste: 'M108 91 q12 -9 24 0',
    seria: 'M108 89 h24'
  }
  const boca = bocas[estado] || bocas.neutra

  return (
    <svg
      className="mascota"
      width={size}
      height={size}
      viewBox="0 0 240 240"
      role="img"
      aria-label={codigo ? `Taza de café con el error ${codigo}` : 'Taza de café'}
    >
      {/* Vapor */}
      <g className="mascota__vapor" fill="none" strokeLinecap="round" strokeWidth="6">
        <path d="M96 64 C 90 48, 102 42, 96 26" />
        <path d="M120 60 C 114 42, 126 36, 120 18" />
        <path d="M144 64 C 138 48, 150 42, 144 26" />
      </g>

      {/* Plato / base */}
      <ellipse className="mascota__plato" cx="120" cy="214" rx="96" ry="13" />

      {/* Asa */}
      <path
        className="mascota__asa"
        d="M190 108 c 34 0 34 56 0 56"
        fill="none"
        strokeWidth="13"
        strokeLinecap="round"
      />

      {/* Cuerpo de la taza */}
      <path
        className="mascota__cuerpo"
        d="M50 80 H190 V166 a30 30 0 0 1 -30 30 H80 a30 30 0 0 1 -30 -30 Z"
      />

      {/* Código del error impreso en la taza */}
      {codigo ? (
        <text className="mascota__numero" x="120" y="158" textAnchor="middle">
          {codigo}
        </text>
      ) : (
        <g className="mascota__cafe-mini" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(120 150)">
          <path d="M-18 -14 h36 v12 a15 15 0 0 1 -15 12 h-6 a15 15 0 0 1 -15 -12 z" />
          <path d="M18 -10 h6 a7 7 0 0 1 0 14 h-6" />
        </g>
      )}

      {/* Borde superior + café */}
      <ellipse className="mascota__borde" cx="120" cy="80" rx="70" ry="15" />
      <ellipse className="mascota__cafe" cx="120" cy="80" rx="60" ry="11" />

      {/* Carita */}
      <g className="mascota__cara">
        {/* Cejas */}
        <g strokeLinecap="round" strokeWidth="3" fill="none" className="mascota__cejas">
          {estado === 'duda' && <path d="M94 67 q8 -6 18 -1" />}
          {estado === 'duda' && <path d="M130 64 q8 -3 16 2" />}
          {estado === 'triste' && <path d="M94 67 q8 4 18 3" />}
          {estado === 'triste' && <path d="M128 68 q10 -1 18 -3" />}
          {estado === 'seria' && <path d="M94 66 q10 6 18 4" />}
          {estado === 'seria' && <path d="M128 67 q8 -2 18 -4" />}
        </g>

        {/* Ojos */}
        <circle className="mascota__ojo" cx="102" cy="76" r="5" />
        <circle className="mascota__ojo" cx="138" cy="76" r="5" />

        {/* Lágrima en el estado triste */}
        {estado === 'triste' && <path className="mascota__lagrima" d="M102 82 q-4 7 0 10 q4 -3 0 -10" />}

        {/* Boca */}
        <path className="mascota__boca" d={boca} fill="none" strokeLinecap="round" strokeWidth="3.5" />
      </g>
    </svg>
  )
}
