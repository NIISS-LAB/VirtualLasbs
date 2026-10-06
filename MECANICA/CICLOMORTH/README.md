# MOHR LAB — Transformación de esfuerzos y círculo de Mohr
# Ph.D.Arlys Michel Lastre Aleaga

Laboratorio virtual de **tensión plana**: elemento diferencial interactivo, círculo de
Mohr, esfuerzos principales, transformación de esfuerzos, validación matemática en vivo,
análisis de influencia, ejercicios y un módulo de extensión tridimensional.

## Cómo ejecutarlo

**Doble clic en `index.html`.** No requiere servidor, ni instalación, ni conexión.

Se han evitado deliberadamente los **módulos ES**: el protocolo `file://` los bloquea, de
modo que `index.html` no podría abrirse directamente. Los ficheros son scripts clásicos
que publican un único espacio de nombres, `window.MohrLab`, y se cargan en orden desde
`index.html`. Tampoco se usa ninguna librería externa: las ecuaciones se construyen con
marcado propio y CSS (fracciones, radicales y matrices), de modo que no hay MathJax ni
KaTeX que descargar.

Para desarrollo sí conviene un servidor (evita la caché del navegador):

```bash
node tools/serve.js 8321     # http://localhost:8321/
node tests/run.js            # suite de validación en línea de órdenes
```

En `tests/index.html` está la misma suite con informe legible en el navegador.

---

## Arquitectura

```
MOHR-LAB/
├── index.html              estructura y orden de carga
├── css/styles.css          sistema visual completo
├── js/
│   ├── units.js            unidades, conversión y formato numérico
│   ├── stress.js           MODELO: tensor, invariantes, clasificación, 3D
│   ├── mohr.js             geometría del círculo (centro, radio, puntos, ángulos)
│   ├── transformations.js  ecuaciones de transformación, Q, σ′ = QσQᵀ, θp
│   ├── validation.js       comprobación en vivo + suite de 18 pruebas
│   ├── equations.js        presentación de la matemática en HTML
│   ├── visualization.js    visores SVG: elemento, círculo, 3D, construcción
│   ├── charts.js           gráfica σθ(θ), τθ(θ)
│   ├── influence.js        derivadas analíticas y sonda de cada variable
│   ├── exercises.js        generador y corrector de ejercicios
│   ├── export.js           informe, procedimiento docente, SVG/PNG, impresión
│   └── app.js              estado, interfaz y orquestación
├── assets/                 favicon y logotipo
├── tests/                  suite de pruebas (navegador y Node)
└── tools/                  servidor de desarrollo y auditoría de disposición
```

`app.js` es la **única** capa que toca el DOM de la interfaz. La matemática vive
exclusivamente en `stress.js`, `mohr.js` y `transformations.js`, que no contienen una
sola referencia al DOM ni al formato: devuelven números en doble precisión, sin redondear.

### Flujo de una sola fuente de verdad

```
ENTRADAS ──▶ derive() ──▶ MODELO ──▶ VISUALIZACIÓN
                              │
                              ├── resultados, ecuaciones, informe
                              └── validation.js (comprobación en vivo)
```

`derive()` (en `app.js`) es el **único** punto donde se calcula el modelo. Todas las
vistas, tarjetas, ecuaciones e informes leen ese mismo objeto. `σ1`, por ejemplo, se
calcula una sola vez y lo consumen el panel de resultados, el círculo, el elemento, la
gráfica, el informe y el modo docente.

---

## Convención de signos

Es única en toda la aplicación y se declara en pantalla:

| Símbolo | Signo | Significado |
|---|---|---|
| `σ > 0` | tracción | la cara se aleja del centro |
| `σ < 0` | compresión | la cara se acerca al centro |
| `τxy > 0` | cortante positivo | en la cara +x actúa hacia +y; en la +y, hacia +x |
| `θ` | antihorario | desde +x hasta la normal exterior de la cara θ |

En el círculo, `τ` se representa **hacia arriba** y el punto `P` avanza un ángulo
**2θ en sentido horario**. Ésa es la razón de que el ángulo en el círculo sea el doble
del ángulo físico y de sentido opuesto.

### Deducción de la relación angular

Con `A₀ = (σx−σy)/2` y `B₀ = τxy`, las ecuaciones de transformación dan

```
P − C = ( A₀·cos2θ + B₀·sen2θ ,  −A₀·sen2θ + B₀·cos2θ ) = Rot(−2θ)·(A₀, B₀)
```

De aquí la **inversa exacta** que permite arrastrar `P` respetando la geometría:

```
2θ = ∠(A₀, B₀) − ∠(P − C)        →  ML.mohr.thetaFor()
```

`projectOnCircle()` proyecta cualquier puntero sobre la circunferencia, de modo que
**P no puede salirse nunca del círculo**.

### Convención de tracción en el dibujo

De `t = σ·n`, evaluada en la base local `(e₁, e₂)`:

- cara de normal `e₁`: `t = σθ·e₁ + τθ·e₂`
- cara de normal `e₂`: `t = τθ·e₁ + σ⊥·e₂`

El cortante es el **mismo** componente del tensor (`σ′₁₂ = σ′₂₁ = τθ`) en ambas parejas
de caras. En el dibujo, la flecha normal se traza siempre a lo largo de la normal
exterior con el valor `σ` sin alterar: una tracción apunta hacia fuera en las cuatro
caras. La lista de vectores la produce `ML.tf.arrowSet()` —la misma que consume el
renderizador y sobre la que trabaja la prueba 16—, de modo que un error de signo en el
dibujo no puede escapar a la validación.

---

## Verificación

`validation.js` contiene **18 pruebas**. No repiten las fórmulas de la aplicación: cuando
pueden usan una vía de cálculo independiente, de modo que la concordancia es
informativa.

| # | Qué verifica |
|---|---|
| 1–4 | Los cuatro casos obligatorios, con los valores esperados fijados en el enunciado |
| 5–8 | Cortante puro a 45°, hidrostático, compresión uniaxial, normalización de θp con τxy < 0 |
| 9 | θp produce σ1 con τ = 0; θs produce \|τ\| = R con σ = σavg; separación de 45° |
| 10 | Ortogonalidad de Q y equivalencia `σ′ = QσQᵀ` en 400 ángulos |
| 11 | Barrido aleatorio de 3000 estados: invariantes, circunferencia e idempotencia θ → P → θ |
| 12–13 | Conversión de unidades ida y vuelta en las cinco unidades |
| 14 | Consistencia plano ↔ 3D con σz = 0 |
| 15 | `τmax = (σ1−σ2)/2` y `σavg = (σ1+σ2)/2` en 2000 estados |
| 16 | Convención de tracción: `t = σ·n` contra el cálculo directo, `ΣF = 0`, `ΣM = 0`, `t·n̂ = σ`, `t·t̂ = τ` y posición del origen, en 40 ángulos |
| 17–18 | Rango completo de σθ(θ) y τθ(θ) localizados por búsqueda ternaria |
| — | Ecuación característica `λ² − I1λ + I2 = 0` frente a `σavg ± R` |

La aplicación ejecuta la suite al arrancar y muestra el resultado en el panel
**Autodiagnóstico**.

### Auditoría de disposición

`tools/audit-layout.js` comprueba en el navegador que **ningún** nodo de los tres
visores —incluidas las etiquetas, los rótulos de los ejes y los textos de los pasos de la
construcción— queda fuera de su lienzo. Se ejecuta sobre 14 estados extremos
(hidrostático, estado nulo, R enorme, R minúsculo, origem muy alejado, σ2 muy negativa)
y cuatro posiciones del reloj de construcción: 56 comprobaciones por visor, todas limpias.

---

## Construcción paso a paso del círculo

El botón **Construcción paso a paso** abre unDidactic de ocho pasos que se dibujan en el
propio círculo, con las líneas apareciendo como si se trazaran con compás
(`stroke-dashoffset`):

1. El estado sobre el eje σ → `D = (σx, 0)`, `E = (σy, 0)`
2. Los cortantes opuestos → `A = (σx, τxy)`, `B = (σy, −τxy)` y los catetos del Triedro de Gauss
3. El centro → `C` es el punto medio del diámetro AB
4. La circunferencia de radio `R = |AB|/2`
5. Los esfuerzos principales σ1, σ2
6. El esfuerzo cortante máximo τmax
7. El punto P: la relación `θ_Mohr = 2·θ_físico`
8. Construcción cerrada

El reloj de construcción es un número real: su parte entera decide qué elementos existen y
su parte fraccionaria anima el trazo del paso en curso. **El último paso produce
exactamente la misma vista que el modo interactivo** — se verifica comparando el DOM:
86 nodos en ambos casos—, de modo que no existe un segundo dibujo que pueda divergir del
primero. Durante la construcción el arrastre de P se desactiva.

Si el origen (σ = 0) no cabe junto a una circunferencia legible —σavg = 995 con R = 5, por
ejemplo— se desplaza el eje, se marca el origen fuera de escala y el pie lo explica: es
preferible un círculo legible a un círculo de un píxel en un eje de 2000 unidades.

---

## Extensión tridimensional

La arquitectura ya separa el estado plano del tensor completo. Añadiendo σz (con
τyz = τxz = 0) la pestaña **Estado 3D** calcula los tres esfuerzos principales por la
solución trigonométrica de la ecuación característica cúbica, los tres círculos de Mohr
**C₁ = (σ1,σ2)**, **C₂ = (σ2,σ3)** y **C₃ = (σ1,σ3)** —coaxiales, con las líneas de
construcción trazadas y C₃ resaltada por ser la que gobierna el criterio de fallo—, más
Tresca, von Mises, τ octaédrico e invariantes. La matemática es exacta; el núcleo
interactivo sigue siendo el estado plano.

Extensiones naturales ya contempladas en el modelo: deformaciones, rosetas extensométricas,
torsión, flexión y superficies de falla.

---

## Sistema visual

Concepto de **banco de instrumentos**, no panel de control comercial. Chasis frío de
grafito, reglas grabadas de un píxel, densidad alta y cero decoración.

- **Color con significado, nunca decorativo.** Azul = tracción, rojo = compresión,
  latón = cortante. Son los tres componentes del esfuerzo. Además, todo estado lleva un
  glifo textual (↑ ↓ →), de modo que nunca depende sólo del color.
- **Tipografía de dos voces.** `Bahnschrift` (grotesca DIN, la del plano técnico) para
  rótulos estructurales; `Cascadia Mono` con cifras tabulares para toda lectura numérica.
  Sólo fuentes del sistema: funciona sin conexión.
- **Lecturas con cifras significativas completas.** `80.000` y `80` no son la misma
  precisión comunicada, así que las lecturas conservan los ceros finales. Sólo la
  retícula los recorta. Para órdenes de magnitud extremos se pasa a `m×10ⁿ` conservando
  los decimales, y nunca se muestra `0.000` para un valor distinto de cero.
- **Sin librerías, sin emojis, sin animaciones decorativas.** El único movimiento es el
  que responde a una acción del usuario —el trazado de la construcción— y se respeta
  `prefers-reduced-motion`.
- **Accesibilidad.** Navegación completa por teclado (flechas ±0.5°, Mayús ±5°,
  RePág ±15°; pestañas con patrón ARIA), etiquetas explícitas, contraste verificado,
  indicadores no dependientes del color y hoja de impresión para PDF.

### Detalles de implementación que conviene conocer

- **Proyección del eje σ.** El centro de la circunferencia C = (σavg, 0) se dibuja en el
  centro del marco de trazado, luego la proyección es

  ```
  X(σ) = cx + (σ − σavg)·k          Y(τ) = cy − τ·k
  ```

  y el cero σ = 0 cae en `cx − σavg·k`, dentro o fuera del marco. No existe ningún
  desplazamiento artificial. Usar `cx + σ·k` sitúa el cero en el centro del marco y saca
  σ1, σ2 y los radios del lienzo en cuanto σavg ≠ 0.

- **`circleScale()` es el único lugar que decide la escala.** No hay una segunda
  corrección «por si acaso» en el visor: cuando elige la escala de ajuste (`kFit`)
  garantiza por construcción que el origen cabe, porque la extensión de datos incluye
  siempre el 0 y `kFit ≤ (ancho/2 − margen)/halfX`. Una corrección segunda calculaba mal
  el espacio disponible —88 px en lugar de los 250 px reales—, encogía el círculo en
  casi todos los estados y hacía que la escala partiese de 0,5 a 8,0 al mover un
  deslizador: el círculo dejaba de responder a R y parecía congelado.

- **La actualización no depende de `requestAnimationFrame`.** rAF sólo se concede si el
  navegador compone la página; con la pestaña oculta, la ventana ocluida o un entorno sin
  compositor, el fotograma no llega nunca y la interfaz se queda con el estado ya
  calculado pero sin pintar. `schedule()` agrupa las actualizaciones con rAF **y** mantiene
  un temporizador de seguridad que fuerza el render si el fotograma no llega. rAF sigue
  mandando mientras hay fotogramas, así que el arrastre no cambia de comportamiento. Al
  volver a verse la pestaña también se vuelca lo pendiente.

- **Los visores usan un único volteo de coordenadas.** Toda la geometría del elemento se
  calcula en coordenadas matemáticas (Y hacia arriba) y pasa por un solo punto de
  volteo, `pt()`. Sin esa disciplina el elemento queda espejado respecto de los ejes
  globales y las flechas de cortante apuntan al revés.
- **Los visores no letterboxean.** El `viewBox` tiene la misma proporción que el ancho
  disponible, de modo que la conversión puntero → coordenadas es una homotecia simple.
- **Sólo se materializa la pestaña visible.** Los siete paneles sumaban más de 800 nodos y
  se reconstruían en cada fotograma; con el renderizado perezoso el coste de `render()`
  bajó de 5,7 ms a 1–4 ms, muy por debajo del presupuesto de 16,7 ms de 60 fps. La
  navegación entre pestañas sí pinta de inmediato, para no mostrar un hueco vacío.
- **Los paneles con campos de entrada construyen su esqueleto una sola vez** y después
  sólo refrescan el contenido, para que el foco y la posición del cursor nunca se
  pierdan al recalcular el modelo.
