import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle('Displace API')
    .setDescription('The public API for Displace communities and clients.')
    .setVersion('1.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup('api/docs', app, openApiDocument);
}
