# Voyageo

Comparateur de vols et d'hebergements avec interface Angular et API Spring Boot.

## Lancer les tests

- Backend : `cd backend && ./mvnw test` (Java 21)
- Frontend : `cd frontend && npm ci && npm test`
- Build frontend : `cd frontend && npm run build`

## SonarQube / SonarCloud

Le fichier `sonar-project.properties` configure l'analyse locale combinee Java et TypeScript.
Apres les tests et la compilation backend, lancez le scanner avec le meme token que celui
de votre serveur SonarQube ou SonarCloud :

```sh
sonar_args=("-Dsonar.projectKey=${SONAR_PROJECT_KEY:-voyageo}" "-Dsonar.token=$SONAR_TOKEN")
if [ -n "${SONAR_HOST_URL:-}" ]; then sonar_args+=("-Dsonar.host.url=$SONAR_HOST_URL"); fi
if [ -n "${SONAR_ORGANIZATION:-}" ]; then sonar_args+=("-Dsonar.organization=$SONAR_ORGANIZATION"); fi
sonar-scanner "${sonar_args[@]}"
```

SonarCloud est utilise par defaut par le scanner ; pour un serveur SonarQube auto-heberge,
definissez `SONAR_HOST_URL`. SonarCloud requiert aussi `SONAR_ORGANIZATION`. Ne stockez jamais
le token dans Git. La CI GitHub Actions utilise `SONAR_TOKEN` comme secret, `SONAR_HOST_URL`
comme variable de depot (par defaut SonarCloud), `SONAR_ORGANIZATION` pour SonarCloud et
`SONAR_PROJECT_KEY` (par defaut `voyageo`). Sans token ou parametres requis, les tests et builds
continuent mais l'etape d'analyse est explicitement signalee comme ignoree.

## Persistance et alertes

Le backend utilise H2 localement par defaut. Pour une base PostgreSQL persistante en production,
configurez `SPRING_DATASOURCE_URL` au format `jdbc:postgresql://...`, `SPRING_DATASOURCE_DRIVER_CLASS_NAME`
avec `org.postgresql.Driver`, ainsi que `SPRING_DATASOURCE_USERNAME` et `SPRING_DATASOURCE_PASSWORD`
dans les variables d'environnement securisees de l'hebergeur.

Les alertes de prix sont verifiees toutes les six heures par le backend et reposent uniquement
sur des tarifs vols reels retournes par Aviasales. Elles apparaissent dans le compte Voyageo.
L'envoi d'e-mails est optionnel : configurez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
`SMTP_PASSWORD` et `SMTP_FROM` dans l'hebergeur. Les alertes ne sont pas verifiees lorsque
l'instance backend est arretee ou mise en veille.
