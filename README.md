# CyberVR SOC

Simulador educativo en primera persona, para el navegador, sobre redes y ciberseguridad. El estudiante recorre las instalaciones de una empresa ficticia, practica en un laboratorio de redes y resuelve casos en un Centro de Operaciones de Seguridad (SOC) hasta obtener un certificado simulado.

**Contexto académico:** proyecto de la materia I+D+i II, quinto semestre de Ingeniería de Sistemas, Universidad ECCI.

## Cómo ejecutarlo

El proyecto no necesita instalación ni compilación, pero debe abrirse desde un servidor local: los módulos de JavaScript no cargan si se abre `index.html` con doble clic.

```bash
git clone https://github.com/DanielGalindoJ/vr-i-d-i.git
cd vr-i-d-i
python -m http.server 8000
```

Luego abre <http://localhost:8000> en un navegador de escritorio con WebGL. Se necesita conexión a Internet porque Three.js se descarga desde un CDN.

## Controles

| Tecla | Acción |
| --- | --- |
| `W` `A` `S` `D` | Moverse |
| `Shift` | Correr |
| Mouse | Mirar |
| `E` | Interactuar |
| `M` | Activar o silenciar la música |
| `N` | Cambiar de pista |
| `Esc` | Pausar o salir de una estación |

## Recorrido de aprendizaje

Las misiones se desbloquean en orden y suman 2650 XP en total.

| # | Misión | Tipo de práctica | XP |
| --- | --- | --- | --- |
| 1 | Inducción al SOC | Preguntas | 100 |
| 2 | Fundamentos de redes | Preguntas | 150 |
| 3 | Taller de cableado | Ponchar cables T568A/T568B, usar el tester y el patch panel | 200 |
| 4 | Armado físico de la red | Conectar equipos con el cable y el puerto correctos | 200 |
| 5 | Lab completo | Encender equipos, ajustar la BIOS, configurar router, DHCP y NAT, verificar, guardar y apagar | 350 |
| 6 | Diagnóstico de fallas | Resolver seis tickets en una red con errores | 300 |
| 7 | Análisis de phishing | Encontrar indicadores en un correo | 150 |
| 8 | Investigación en el SIEM | Analizar registros | 200 |
| 9 | Contención en el firewall | Crear una regla de bloqueo | 200 |
| 10 | Threat hunting | Investigar un equipo desde una consola | 250 |
| 11 | Respuesta a incidentes | Ordenar las fases y tomar decisiones | 250 |
| 12 | Examen final | 10 preguntas aleatorias; se aprueba con 70 % | 300 |

Además, el **laboratorio libre** queda disponible tras la inducción y no afecta el XP. Permite crear una red desde cero o resolver retos de VLAN, rutas estáticas y DHCP.

## Simulador de red

Los laboratorios funcionan sobre un simulador propio, no sobre respuestas predefinidas: el resultado de un `ping` depende del cableado y de la configuración que haya hecho el estudiante.

- **Equipos:** PC, servidor, impresora, switch, router y proveedor de Internet.
- **Protocolos y funciones:** IPv4, ARP, VLAN con trunk, subinterfaces, rutas estáticas, DHCP, NAT con sobrecarga y DNS.
- **Consolas:** comandos de red al estilo de Cisco IOS en routers y switches, y comandos de Windows como `ipconfig`, `ping`, `tracert` y `nslookup` en los equipos finales.

## Tecnologías

- HTML, CSS y JavaScript con módulos ES, sin frameworks ni dependencias que instalar.
- [Three.js](https://threejs.org/) para el mundo 3D.
- Web Audio API para la música y los efectos, generados en tiempo real sin archivos de audio.
- `localStorage` para guardar el progreso en el navegador.

## Estructura

```text
index.html       Estructura de la página e interfaz
css/styles.css   Estilos
js/main.js       Mundo 3D, controles y progreso
js/missions.js   Catálogo de misiones, preguntas y pruebas del SOC
js/labs.js       Laboratorios y mesa de trabajo
js/netsim.js     Simulador de red
js/netcli.js     Consolas de comandos
js/audio.js      Música y efectos de sonido
```

## Limitaciones

- La experiencia de "realidad virtual" es una ambientación en primera persona: no usa WebXR ni es compatible con visores VR.
- El simulador es una simplificación con fines educativos. No modela, entre otros, STP, enrutamiento dinámico ni pérdida de paquetes, y solo acepta un subconjunto de comandos.
- Internet está simulado con unos pocos destinos, como `8.8.8.8` y `example.com`.
- El Auto-MDIX está apagado por defecto para practicar la elección entre cable directo y cruzado. En el modo libre se puede activar.
- El progreso se guarda solo en el navegador donde se juega, y el certificado es un ejercicio sin validez oficial.
- CyberCorp S.A.S. es una empresa ficticia. El proyecto no tiene relación con Cisco ni con otros fabricantes.
