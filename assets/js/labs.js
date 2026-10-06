/* Registro del centro Virtual Lab Center.
   Generado por server.js — no hace falta editarlo a mano.
   Se usa cuando index.html se abre directamente con doble clic (file://),
   donde el navegador no puede leer carpetas por sí solo. */
window.VLC_REGISTRY = {
  "areas": [
    {
      "id": "ELECTRICIDAD",
      "folder": "ELECTRICIDAD",
      "order": 1,
      "title": {
        "es": "Electricidad",
        "en": "Electrical engineering"
      },
      "labs": 4
    },
    {
      "id": "MECANICA",
      "folder": "MECANICA",
      "order": 999,
      "title": {
        "es": "MECANICA",
        "en": "MECANICA"
      },
      "labs": 2
    }
  ],
  "labs": [
    {
      "id": "circuitos-ohm",
      "folder": "circuitos-ohm",
      "areaId": "ELECTRICIDAD",
      "main": "ELECTRICIDAD/circuitos-ohm/index.html",
      "order": 1,
      "icon": "bolt",
      "tags": [
        "circuitos",
        "cd/08",
        "primera ley"
      ],
      "title": {
        "es": "Ley de Ohm",
        "en": "Ohm's law"
      },
      "area": {
        "es": "Electrotecnia",
        "en": "Electrical technology"
      },
      "summary": {
        "es": "Simulador de tensión, corriente y potencia con esquema del circuito en vivo.",
        "en": "Voltage, current and power simulator with a live circuit diagram."
      },
      "pages": [
        {
          "path": "ELECTRICIDAD/circuitos-ohm/index.html",
          "file": "index.html",
          "title": {
            "es": "Index",
            "en": "Index"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        },
        {
          "path": "ELECTRICIDAD/circuitos-ohm/fundamentos.html",
          "file": "fundamentos.html",
          "title": {
            "es": "Fundamentos y ejercicios",
            "en": "Fundamentals and exercises"
          },
          "summary": {
            "es": "Las tres leyes de Ohm, potencia disipada y cinco ejercicios resueltos.",
            "en": "The three Ohm laws, dissipated power and five solved exercises."
          }
        }
      ]
    },
    {
      "id": "osciloscopio-rc",
      "folder": "osciloscopio-rc",
      "areaId": "ELECTRICIDAD",
      "main": "ELECTRICIDAD/osciloscopio-rc/index.html",
      "order": 2,
      "icon": "wave",
      "tags": [
        "osciloscopio",
        "transitorios",
        "rc"
      ],
      "title": {
        "es": "Respuesta de un circuito RC",
        "en": "RC circuit response"
      },
      "area": {
        "es": "Señales y transitorios",
        "en": "Signals and transients"
      },
      "summary": {
        "es": "Carga y descarga de un condensador sobre la retícula del osciloscopio, con constante de tiempo en pantalla.",
        "en": "Capacitor charge and discharge plotted on a scope graticule, with the time constant on screen."
      },
      "pages": [
        {
          "path": "ELECTRICIDAD/osciloscopio-rc/index.html",
          "file": "index.html",
          "title": {
            "es": "Index",
            "en": "Index"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        }
      ]
    },
    {
      "id": "guia-taller",
      "folder": "guia-taller",
      "areaId": "ELECTRICIDAD",
      "main": "ELECTRICIDAD/guia-taller/index.html",
      "order": 3,
      "icon": "clipboard",
      "tags": [
        "taller",
        "protocolo",
        "materiales"
      ],
      "title": {
        "es": "Guía de taller",
        "en": "Workshop guide"
      },
      "area": {
        "es": "Taller y protocolo",
        "en": "Workshop and protocol"
      },
      "summary": {
        "es": "Preparación, protocolo paso a paso y lista de materiales del taller de medición.",
        "en": "Preparation, step-by-step protocol and the material list for the measurement workshop."
      },
      "pages": [
        {
          "path": "ELECTRICIDAD/guia-taller/index.html",
          "file": "index.html",
          "title": {
            "es": "Index",
            "en": "Index"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        },
        {
          "path": "ELECTRICIDAD/guia-taller/materiales.html",
          "file": "materiales.html",
          "title": {
            "es": "Materiales y equipos",
            "en": "Materials and equipment"
          },
          "summary": {
            "es": "Cantidades, especificaciones y equipos compartidos por grupo.",
            "en": "Quantities, specifications and equipment shared per group."
          }
        },
        {
          "path": "ELECTRICIDAD/guia-taller/protocolo.html",
          "file": "protocolo.html",
          "title": {
            "es": "Protocolo de medición",
            "en": "Measurement protocol"
          },
          "summary": {
            "es": "Diez pasos con seguridad, conexiones y lecturas esperadas.",
            "en": "Ten steps with safety, connections and expected readings."
          }
        }
      ]
    },
    {
      "id": "LV-TRNASFORMADOR",
      "folder": "LV-TRNASFORMADOR",
      "areaId": "ELECTRICIDAD",
      "main": "ELECTRICIDAD/LV-TRNASFORMADOR/LV-transformadores.html",
      "order": 4,
      "icon": "",
      "tags": [],
      "title": {
        "es": "Laboratorio Virtual de Transformadores",
        "en": "Virtual Transformers Lab"
      },
      "area": {
        "es": "Electricidad",
        "en": "Electrical engineering"
      },
      "summary": {
        "es": "Simulador de transformadores: relación de vueltas, flujo, pérdidas y regulación en carga.",
        "en": "Transformer simulator: turns ratio, flux, losses and regulation under load."
      },
      "pages": [
        {
          "path": "ELECTRICIDAD/LV-TRNASFORMADOR/LV-transformadores.html",
          "file": "LV-transformadores.html",
          "title": {
            "es": "LV transformadores",
            "en": "LV transformadores"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        }
      ]
    },
    {
      "id": "CICLOMORTH",
      "folder": "CICLOMORTH",
      "areaId": "MECANICA",
      "main": "MECANICA/CICLOMORTH/index.html",
      "order": 999,
      "icon": "",
      "tags": [],
      "title": {
        "es": "CICLOMORTH",
        "en": "CICLOMORTH"
      },
      "area": {
        "es": "MECANICA",
        "en": "MECANICA"
      },
      "summary": {
        "es": "1 página disponible",
        "en": "1 page available"
      },
      "pages": [
        {
          "path": "MECANICA/CICLOMORTH/index.html",
          "file": "index.html",
          "title": {
            "es": "Index",
            "en": "Index"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        }
      ]
    },
    {
      "id": "DIBUJO",
      "folder": "DIBUJO",
      "areaId": "MECANICA",
      "main": "MECANICA/DIBUJO/VÍSTAS.html",
      "order": 999,
      "icon": "",
      "tags": [],
      "title": {
        "es": "DIBUJO",
        "en": "DIBUJO"
      },
      "area": {
        "es": "MECANICA",
        "en": "MECANICA"
      },
      "summary": {
        "es": "1 página disponible",
        "en": "1 page available"
      },
      "pages": [
        {
          "path": "MECANICA/DIBUJO/VÍSTAS.html",
          "file": "VÍSTAS.html",
          "title": {
            "es": "VÍSTAS",
            "en": "VÍSTAS"
          },
          "summary": {
            "es": "",
            "en": ""
          }
        }
      ]
    }
  ],
  "loose": [],
  "generated": "2026-10-06T03:26:36.647Z"
};
