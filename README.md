# VIRTUAL LAB CENTER

Centro de laboratorios virtuales. El menú **no está escrito a mano**: se construye
con las carpetas y páginas HTML que hay en el root.

- Árbol por **área → práctica → páginas**, con filtro por área y buscador.
- Cada práctica se abre en el visor; la cabecera conserva el botón de vuelta al índice.
- Tema claro y oscuro, interfaz en español e inglés.
- Fondo 3D animado en la portada, hecho con canvas y sin librerías.

## No necesita servidor

**Doble clic en `index.html` y listo.** El navegador arma el índice por su cuenta:

1. Con el **registro incrustado** (`assets/js/labs.js`), que viaja con el proyecto.
2. Si no está o quieres refrescarlo: botón **“Buscar la carpeta del proyecto”**, o
   **arrastra la carpeta del root encima de la ventana**. Se lee en el navegador y se
   guarda en `localStorage`, así que la próxima vez ya está listo.
3. Con `?source=embedded`, `?source=manifest` o `?source=none` se fuerza el origen.

Al añadir una carpeta nueva no hay que compilar nada: vuelve a escanear desde el botón
**Releer carpetas** (pulsa también el texto verde que indica el origen del índice).

### ¿Y `server.js`?

Es **opcional**. Añade una cosa: servir por `http://localhost:5173` con el índice
vivo, que se relee del disco en cada visita y también regenera `manifest.json` y
`assets/js/labs.js`.

| Quiero… | Hago |
| --- | --- |
| Abrir el centro ya, sin instalar nada | doble clic en `index.html` |
| Modo automático, que arranque solo | doble clic en `INICIAR.cmd` |
| Lo mismo desde PowerShell | `.\INICIAR.ps1` |
| Servir en otro puerto | `node server.js --port 8080` |

> Una página abierta con `file://` no puede lanzar procesos: es una restricción del
> navegador, no del proyecto. Por eso el arranque automático se hace con `INICIAR.cmd`,
> que sí puede invocar Node.

## Estructura del root

```
root/
  index.html                 landing y visor
  assets/                    estilos y código del centro
  ELECTRICIDAD/              ← área (carpeta con prácticas dentro)
    area.json                opcional: nombre y orden del área
    circuitos-ohm/
      index.html             portada de la práctica
      fundamentos.html
      lab.json               opcional: título es/en, resumen, títulos por página
    LV-TRNASFORMADOR/
      LV-transformadores.html
  MECANICA/                  ← otra área (puede estar vacía)
  manifest.json              generado
  assets/js/labs.js          generado (registro incrustado)
```

Reglas que aplica el escaneo, en el navegador y en el servidor:

- Una carpeta con archivos `.html` propios es una **práctica**.
- Una carpeta sin `.html` propios, pero con subcarpetas que sí los tienen, es un **área**.
- Los `.html` sueltos en el root aparecen bajo **Páginas del root**.
- Se ignoran `assets`, `node_modules` y todo lo que empiece por `_` o `.`.
- `lab.json` da nombre y textos; `area.json` da nombre y orden al área.

## Añadir una práctica

1. Copia una carpeta dentro de un área (o en el root) con su `index.html`.
2. Pulsa **Releer carpetas**. Aparece sola en el árbol.
3. Si quieres nombre propio, añade `lab.json`:

```json
{
  "order": 4,
  "title":   { "es": "Ley de Ohm", "en": "Ohm's law" },
  "summary": { "es": "Qué se hace aquí.", "en": "What happens here." },
  "pages": {
    "guia.html": { "title": { "es": "Guía", "en": "Guide" } }
  }
}
```

## Tus prácticas dentro del visor

Lo mínimo para que la práctica se sienta parte del centro es un enlace de vuelta:

```html
<a class="lab-back" href="../../index.html">← Índice</a>
```

Y, para heredar tema e idioma, escucha el mensaje que envía el visor:

```js
window.addEventListener('message', (e) => {
  if (e.data && e.data.source === 'virtual-lab-center') {
    document.documentElement.dataset.tema = e.data.theme; // 'dark' | 'light'
    // e.data.lang → 'es' | 'en'
  }
});
```

Las prácticas de ejemplo usan `assets/css/lab.css` y `assets/js/lab-kit.js`, que ya
resuelven eso. Tus prácticas pueden ser autonomous: una sola página con su CSS dentro
funciona igual (ver `ELECTRICIDAD/LV-TRNASFORMADOR`).

## Comprobaciones

```bash
npm test     # compara el escaneo del navegador con manifest.json
```

`prueba-escaneo.js` simula el sistema de archivos que devuelve el navegador y verifica
que áreas, rutas, títulos y contadores salen idénticos a los que produce `server.js`.

## Atajos

- `Ctrl/Cmd + [` vuelve al índice.
- Árbol: `↑` `↓` recorren los nodos, `Inicio` y `Fin` van al primero y al último.
- Osciloscopio: `←` `→` mueven el cursor de tiempo.
