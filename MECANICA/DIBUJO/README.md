# Laboratorio Digital de Dibujo Técnico CAD — versión HTML local

Esta versión conserva la composición y el flujo funcional del proyecto Reflex original y sustituye la capa de ejecución Python/Reflex por una aplicación web local.

## Ejecución

1. Descomprima la carpeta.
2. Abra `index.html` con Chrome o Edge.
3. Se requiere Internet para cargar Three.js, OrbitControls, Lucide y las fuentes desde CDN.
4. No requiere Python, Reflex, Node.js ni servidor local para la ejecución normal.

## Funciones conservadas

- 11 módulos de navegación.
- Biblioteca de 18 piezas en 6 niveles.
- Estación 3D interactiva y dibujo 2D vinculado.
- Vistas frontal, superior, lateral, posterior, inferior, isométrica y axonométrica.
- Proyecciones ortogonal, oblicua, isométrica, dimétrica y trimétrica.
- Capas de visibles, ocultas, ejes, centros, cotas, superficies, proyectantes y aristas 3D.
- Cámara ortográfica/perspectiva, modo de representación, material e iluminación.
- Secciones y cortes con tipo de corte, posición, rayado, ángulo y separación.
- Perspectiva de uno, dos y tres puntos, caballera, militar e isométrica.
- Desarrollo de prisma, cilindro, cono y pirámide, con animación.
- Gemelo geométrico 2D–3D e identificadores de aristas/caras.
- Explicación paso a paso y reproducción automática.
- Ejercicios, pistas, evaluación, revisión y progreso.
- Asistente pedagógico local por reglas.
- Persistencia de sesión con `localStorage`.

## Nota técnica

El motor geométrico 3D se mantiene separado en `js/geometry.js`. La interfaz se encuentra en `index.html`, `styles.css` y `js/app.js`.
