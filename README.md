# MANDO

**Tu control, a tu manera.**

## Qué vamos a mostrar

Desde el celular, cada persona configura su mando y lo usa para controlar una TV simulada. La demo local reúne el mando y la TV en una sola pantalla y funciona en un solo equipo. La conexión entre dos dispositivos es un segundo modo de uso.

## Acuerdos de implementación

- La interfaz vive en `public/` y usa HTML, CSS y JavaScript sin framework.
- El navegador guarda el diseño del mando. Node se usa únicamente para conectar dispositivos y mantiene el estado de cada sala en memoria. El proyecto funciona sin base de datos.
- En la demo local, cada acción actualiza el estado en el navegador y vuelve a dibujar la TV.
- La paleta usa azul noche `#101522` de fondo, marfil `#F5F4EE` para el texto y lima `#C9F76A` para destacar controles. Usamos etiquetas claras y tipografía grande para proyectar.

## Contrato compartido

| Función | Responsabilidad |
| --- | --- |
| `mountRemote(el, dispatch)` | Monta el mando en el elemento recibido. Al pulsar un botón, llama a `dispatch` con el nombre de la acción, por ejemplo `dispatch("VOL_UP")`. |
| `renderTV(el, state)` | Dibuja la TV en el elemento recibido con el estado actual. Se llama al iniciar y después de cada cambio. |

Estado inicial de la demo y de cada sala nueva

```js
{ power: true, volume: 15, muted: false, channel: 1 }
```

| Control | Acciones |
| --- | --- |
| Volumen | `VOL_UP`, `VOL_DOWN` |
| Silencio | `MUTE` |
| Canal | `CH_UP`, `CH_DOWN` |
| Encendido | `POWER` |

Cualquier cambio de nombres se acuerda entre las tres compus antes de implementarlo.

## Cómo arrancar en Cursor

Cada compu clona el mismo repo y abre la carpeta `MANDO` en Cursor.

```sh
git clone https://github.com/JuanMorales10/MANDO.git
cd MANDO
```

Desde el mismo primer commit de `main`, cada compu crea su rama. Nombres sugeridos para dividir el trabajo

| Compu | Trabajo | Comando |
| --- | --- | --- |
| 1 | Mando configurable | `git switch -c feat/mando` |
| 2 | Pantalla de TV simulada | `git switch -c feat/tv` |
| 3 | Integración de la demo local y conexión entre equipos | `git switch -c feat/integracion` |

Después de hacer un commit en su rama, cada compu la publica con `git push -u origin HEAD`.
