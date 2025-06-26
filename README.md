# CommitFaker 🎯

Una herramienta poderosa para actualizar tu gráfico de contribuciones de GitHub, incluyendo commits de forks que normalmente no aparecen en tu perfil.

## ✨ Características

- 📊 **Actualiza tu gráfico de contribuciones** de GitHub
- 🔄 **Incluye commits de forks** en tu perfil
- � **Sincroniza commits por email específico** (ej: ccr@unex.es)
- �📅 **Crear commits con fechas específicas**
- 🎨 **Patrones personalizables** de commits
- 🚀 **Fácil de usar** con interfaz de línea de comandos
- 🔧 **Configuración flexible**

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <tu-repo-url>
cd CommitFaker

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tu token de GitHub
```

## 📋 Configuración

1. **Crear un token de GitHub:**
   - Ve a GitHub → Settings → Developer settings → Personal access tokens
   - Genera un nuevo token con permisos de `repo` y `user`
   - Copia el token

2. **Configurar el archivo .env:**
   ```env
   GITHUB_TOKEN=tu_token_aqui
   GITHUB_USERNAME=tu_usuario
   ```

## 🎮 Uso

### Comandos básicos

```bash
# Ejecutar el programa principal
npm start

# O usar directamente
node src/cli.js

# Ver ayuda
node src/cli.js --help
```

### Opciones disponibles

```bash
# Crear commits para un rango de fechas
node src/cli.js fake --start 2024-01-01 --end 2024-12-31 --pattern random

# Sincronizar commits de forks
node src/cli.js sync-forks

# Sincronizar commits por email específico
node src/cli.js email-sync --email ccr@unex.es

# Sincronizar commits con otro email
node src/cli.js email-sync --email carloscambero.ccr@gmail.com

# Sincronizar todos los emails configurados
node src/cli.js email-sync-all --auto-confirm

# Ver emails configurados
node src/cli.js email-list

# Crear patrón específico
node src/cli.js pattern --type wave --intensity medium

# Configurar repositorio
node src/cli.js setup
```

## 🎨 Patrones de Commits

- **random**: Commits aleatorios distribuidos
- **wave**: Patrón de onda sinusoidal
- **streak**: Rachas de commits intensos
- **custom**: Patrón personalizado definido por ti

## 📧 Sincronización por Email

### ¿Qué hace?
Esta funcionalidad busca todos los commits que hayas realizado con emails específicos en todos tus repositorios y los replica en tu repositorio personal para que aparezcan en tu gráfico de contribuciones.

### Emails Configurados:
Por defecto, el proyecto está configurado para sincronizar:
- `ccr@unex.es` (email universitario)
- `carloscambero.ccr@gmail.com` (email personal)

Puedes añadir más emails en el archivo `.env`:
```env
SYNC_EMAILS=ccr@unex.es,carloscambero.ccr@gmail.com,otro@email.com
```

### Casos de uso:
- **Email universitario/laboral**: Commits hechos con tu email institucional
- **Múltiples identidades**: Trabajo realizado con diferentes configuraciones de Git
- **Visibilidad**: Hacer visible trabajo que no aparece en tu perfil principal
- **Organización**: Mantener separados commits por email en carpetas distintas

### Cómo funciona:
1. **Escanea** todos tus repositorios públicos y privados
2. **Identifica** commits realizados con los emails especificados
3. **Analiza** la distribución por fechas, repositorios y emails
4. **Replica** los commits con las fechas originales en tu repositorio personal
5. **Organiza** los commits en carpetas separadas por email (opcional)

### Ejemplos de uso:

#### Modo interactivo:
```bash
npm start
# Seleccionar: "📧 Sincronizar commits por email"
# Elegir email específico o todos
```

#### Línea de comandos:
```bash
# Sincronizar email específico
node src/cli.js email-sync --email ccr@unex.es

# Sincronizar todos los emails configurados
node src/cli.js email-sync-all

# Ver qué emails están configurados
node src/cli.js email-list
```

#### Scripts npm:
```bash
# Sincronizar email específico
npm run email-sync

# Sincronizar todos los emails
npm run email-sync-all

# Ver emails configurados
npm run email-list
```

## ⚙️ Configuración Avanzada

El archivo `config/settings.json` permite personalizar:

- Intensidad de commits por día
- Patrones de fechas
- Repositorios objetivo
- Mensajes de commit personalizados

## 🔧 Desarrollo

```bash
# Modo desarrollo con recarga automática
npm run dev

# Ejecutar tests
npm test
```

## ⚠️ Advertencias

- **Uso ético**: Esta herramienta está diseñada para mostrar tu trabajo real que GitHub no reconoce (como commits en forks)
- **Repositorio privado**: Recomendamos usar un repositorio privado para los commits falsos
- **Respeta las políticas**: Úsala responsablemente y respeta las políticas de GitHub

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Distribuido bajo la Licencia MIT. Ver `LICENSE` para más información.

## 📞 Contacto

Tu nombre - [@tu_twitter](https://twitter.com/tu_twitter) - tu_email@ejemplo.com

Link del Proyecto: [https://github.com/tu_usuario/CommitFaker](https://github.com/tu_usuario/CommitFaker)
