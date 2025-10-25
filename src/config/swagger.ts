// Swagger configuration for API documentation
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';
import config from './index.ts';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CodeEndelea LMS API',
      version: '1.0.0',
      description: 'Learning Management System API with Supabase',
      contact: {
        name: 'CodeEndelea Team',
        email: 'contact@codeendelea.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
            data: {
              type: 'object',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'An error occurred',
            },
            error_code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/**/*.ts'],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Application): void => {
  // Serve custom Swagger UI HTML
  app.get('/api-docs', (_req, res) => {
    res.sendFile('swagger.html', { root: './src/views' });
  });

  // JSON endpoint
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Root redirect to API docs
  app.get('/docs', (_req, res) => {
    res.redirect('/api-docs');
  });
};

export default specs;
