import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sql from 'mssql';

/**
 * Pool de conexiones a Azure SQL, compartido por todos los repositorios.
 * Se conecta en el primer uso: la base serverless puede estar pausada y tardar en despertar,
 * y no queremos que eso impida que la API arranque.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool?: Promise<sql.ConnectionPool>;

  constructor(private readonly config: ConfigService) {}

  async request(tx?: sql.Transaction): Promise<sql.Request> {
    return tx ? new sql.Request(tx) : (await this.conexion()).request();
  }

  /** Ejecuta `fn` en una transacción: confirma si termina bien, deshace si lanza error. */
  async transaccion<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(await this.conexion());
    await tx.begin();
    try {
      const r = await fn(tx);
      await tx.commit();
      return r;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  async onModuleDestroy() {
    if (this.pool) await (await this.pool).close();
  }

  private conexion(): Promise<sql.ConnectionPool> {
    this.pool ??= new sql.ConnectionPool(this.configuracion())
      .connect()
      .then((p) => {
        this.logger.log('Conectado a la base de datos');
        return p;
      })
      .catch((e) => {
        this.pool = undefined; // reintenta en la próxima petición
        throw e;
      });
    return this.pool;
  }

  private configuracion(): sql.config | string {
    const cadena = this.config.get<string>('SQL_CONNECTION_STRING');
    if (cadena) return cadena;

    // Managed Identity: la identidad de la Container App se autentica en SQL, sin contraseña.
    return {
      server: this.config.getOrThrow<string>('SQL_SERVER'),
      database: this.config.getOrThrow<string>('SQL_DATABASE'),
      connectionTimeout: 60_000,
      options: { encrypt: true },
      authentication: {
        type: 'azure-active-directory-default',
        options: { clientId: this.config.get<string>('AZURE_CLIENT_ID') },
      },
    } as sql.config;
  }
}
