type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

export function createLogger(scope: string): Logger {
  const write = (level: Level, msg: string, fields: Fields = {}) => {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, msg, ...fields });
    if (level === 'error') console.error(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}
