export function SecurityContentEs() {
  return (
    <>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC — Plataforma GodManager</strong><br />
      <strong>Responsable: Wellington Alves Gomes, Owner, Godroox LLC</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>1. Propósito y Alcance</h2>
    <p style={{ margin: '0 0 12px' }}>
      Esta Política de Seguridad de la Información describe cómo Godroox LLC (&quot;Godroox&quot;) protege la confidencialidad, la integridad y la disponibilidad de la información tratada por la plataforma GodManager (&quot;el Servicio&quot;). Se aplica a todos los sistemas, datos, personas y servicios de terceros involucrados en la operación del Servicio.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      GodManager es una plataforma de gestión de propiedades en modelo software-as-a-service para empresas de gestión de propiedades en los Estados Unidos. Trata datos empresariales y personales, incluyendo registros de propiedades, información de inquilinos y propietarios, transacciones financieras y — cuando un usuario opta por conectar una cuenta bancaria — tokens de cuenta financiera cifrados obtenidos a través de Plaid.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      Este documento describe tanto los controles actualmente implementados como las mejoras planificadas o en curso, con plazos previstos. Godroox trata la seguridad de la información como un programa continuo de mejora.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>2. Organización y Responsabilidad</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox es una organización pequeña. El Owner, Wellington Alves Gomes, es responsable de las decisiones de seguridad de la información, incluyendo la gestión de accesos, la selección de proveedores, la respuesta a incidentes y la aprobación de cambios en los sistemas de producción.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      El acceso a los sistemas se limita al Owner y a un pequeño número de contratistas verificados, contratados para tareas específicas de desarrollo. El acceso se concede según el principio de mínimo privilegio y se revoca cuando ya no es necesario.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>3. Control de Acceso</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Autenticación:</strong> los usuarios se autentican con un nombre de usuario (correo electrónico) y contraseña. Las contraseñas se almacenan con hashing unidireccional bcrypt (12 rounds); nunca se almacenan contraseñas en texto plano.</li>
      <li style={{ marginBottom: 6 }}><strong>Gestión de sesión:</strong> las sesiones autenticadas usan una cookie segura de tipo HTTP-only. En producción, la cookie de sesión se marca como Secure (transmitida solo por HTTPS) y SameSite, para mitigar riesgos entre sitios. Las sesiones expiran tras 24 horas.</li>
      <li style={{ marginBottom: 6 }}><strong>Protección contra fuerza bruta:</strong> los intentos de inicio de sesión se limitan (un número máximo de intentos por ventana de tiempo, con bloqueo temporal) para disuadir la adivinación automatizada de contraseñas.</li>
      <li style={{ marginBottom: 6 }}><strong>Control de acceso basado en funciones:</strong> el Servicio define funciones de usuario distintas (administrador, gerente, contador, arrendamiento, mantenimiento, campo, visualizador, propietario, inquilino, proveedor y superadministrador de la plataforma). El acceso a funciones y datos se controla por función y por permisos por sección.</li>
      <li style={{ marginBottom: 6 }}><strong>Aislamiento entre inquilinos:</strong> el Servicio es multiinquilino. Los datos de cada organización cliente se delimitan mediante un identificador de cliente, de modo que los usuarios accedan solo a los datos pertenecientes a su organización. El aislamiento por fila en la base de datos proporciona defensa en profundidad.</li>
      <li style={{ marginBottom: 6 }}><strong>Acceso administrativo:</strong> el acceso a la infraestructura de producción (alojamiento, base de datos, almacenamiento, repositorio de código) está restringido al Owner y protegido por autenticación multifactor (MFA) en cada cuenta de proveedor. Las credenciales se almacenan en un gestor de contraseñas, no en texto plano ni en el código.</li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>4. Protección de Datos y Cifrado</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Cifrado en tránsito:</strong> todo el tráfico entre clientes y el Servicio se sirve por HTTPS/TLS mediante los proveedores de alojamiento y de borde.</li>
      <li style={{ marginBottom: 6 }}><strong>Cifrado de credenciales sensibles en reposo:</strong> los tokens de acceso a cuentas bancarias obtenidos a través de Plaid se cifran en la capa de aplicación con AES-256-GCM antes de almacenarse. La clave de cifrado se mantiene solo en la configuración del entorno de producción y nunca se incluye en el control de versiones.</li>
      <li style={{ marginBottom: 6 }}><strong>Hashing de contraseñas:</strong> como se indicó, se usa bcrypt para todas las contraseñas de cuenta.</li>
      <li style={{ marginBottom: 6 }}><strong>Sin almacenamiento de datos de tarjeta:</strong> Godroox no almacena números completos de tarjetas de pago. Los pagos de suscripción con tarjeta son gestionados por Stripe.</li>
      <li style={{ marginBottom: 6 }}><strong>Base de datos y almacenamiento:</strong> la base de datos de producción (PostgreSQL) y el almacenamiento de objetos (Cloudflare R2) son alojados por proveedores reconocidos que aplican cifrado en reposo a nivel de infraestructura.</li>
    </ul>
    <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Mejoras planificadas (protección de datos)</h3>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Cifrado de campos sensibles adicionales:</strong> ciertos campos sensibles ingresados por las organizaciones clientes (por ejemplo, SSN/ITIN de inquilino y datos de cuenta bancaria de proveedor) se almacenan actualmente en texto plano dentro de la base de datos aislada por inquilino. Godroox está implementando cifrado en la capa de aplicación (usando el mismo mecanismo AES-256-GCM ya en uso para los tokens de Plaid) para estos campos. <strong>Plazo: hasta 60 días.</strong></li>
      <li style={{ marginBottom: 6 }}><strong>Tokens de sesión firmados:</strong> Godroox está actualizando las cookies de sesión para usar firma criptográfica (HMAC) a fin de proteger aún más la integridad de la sesión. <strong>Plazo: hasta 60 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>5. Seguridad de Red y Transporte</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>El Servicio se entrega por HTTPS/TLS mediante la plataforma de alojamiento (Railway) y el proveedor de borde/CDN (Cloudflare).</li>
      <li style={{ marginBottom: 6 }}>Godroox está agregando cabeceras de respuesta HTTP de seguridad (incluyendo HTTP Strict Transport Security, X-Content-Type-Options, X-Frame-Options y Referrer-Policy) en la capa de aplicación para reforzar el HTTPS y reducir riesgos web comunes. <strong>Plazo: hasta 30 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>6. Registro, Monitoreo y Auditoría</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Registro de auditoría:</strong> las acciones importantes (como eliminaciones de registros, actualizaciones de saldo, cambios de contraseña y modificaciones de documentos financieros) se registran en un log de auditoría que captura el autor, fecha/hora, dirección IP, user agent y contexto relevante.</li>
      <li style={{ marginBottom: 6 }}><strong>Monitoreo de la aplicación:</strong> los errores de la aplicación y los eventos operativos se registran a través de la plataforma de alojamiento.</li>
      <li style={{ marginBottom: 6 }}><strong>Mejora planificada:</strong> Godroox está ampliando la cobertura de auditoría a operaciones sensibles adicionales y definiendo un período de retención de logs. <strong>Plazo: hasta 90 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>7. Gestión de Proveedores y Subencargados</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox depende de proveedores externos establecidos y reconocidos, cada uno tratando solo los datos necesarios para su función:
    </p>
    <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginTop: 12, marginBottom: 16, fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Proveedor</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Función</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Notas</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Railway</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Alojamiento de la aplicación y base de datos PostgreSQL</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Estados Unidos</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Cloudflare R2</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Almacenamiento de objetos (fotos, documentos)</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Cifrado en reposo</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Stripe</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Procesamiento de pagos de suscripción</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Conforme a PCI; sin almacenamiento de datos de tarjeta por Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Plaid</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Verificación y vinculación de cuentas bancarias</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Productos Auth e Identity; tokens de acceso cifrados por Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Resend</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Entrega de correos transaccionales</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Crisp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Chat en el sitio de marketing</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Ramp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Integración de tarjeta corporativa / gastos</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Intuit QuickBooks</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Integración contable opcional</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Habilitada por cliente</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Anthropic</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Funciones asistidas por IA</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
      </tbody>
    </table>
    <p style={{ margin: '0 0 12px' }}>
      Godroox selecciona proveedores que mantienen prácticas de seguridad reconocidas y revisa esta lista periódicamente.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>8. Integración con Plaid — Alcance y Tratamiento</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Godroox usa los productos <strong>Auth</strong> e <strong>Identity</strong> de Plaid para verificar y vincular cuentas bancarias a solicitud del usuario.</li>
      <li style={{ marginBottom: 6 }}>Godroox <strong>no</strong> usa Plaid para mover dinero, iniciar pagos u obtener historial de transacciones.</li>
      <li style={{ marginBottom: 6 }}>Godroox <strong>no</strong> recibe ni almacena las credenciales de banca en línea de los usuarios; estas son gestionadas exclusivamente por Plaid.</li>
      <li style={{ marginBottom: 6 }}>Los datos recibidos de Plaid (tokens de acceso y metadatos limitados de la cuenta) se tratan como sensibles. Los tokens de acceso se cifran en reposo (AES-256-GCM). Solo se retienen los últimos dígitos de un número de cuenta (la máscara) para su visualización.</li>
      <li style={{ marginBottom: 6 }}>Los usuarios pueden desconectar una cuenta vinculada; Godroox está agregando un flujo de desconexión/revocación self-service. <strong>Plazo: hasta 60 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>9. Gestión de Vulnerabilidades</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Godroox depende de infraestructura gestionada y parcheada de sus proveedores de alojamiento y plataforma, y mantiene actualizadas las dependencias de la aplicación.</li>
      <li style={{ marginBottom: 6 }}>Los cambios de código que afectan a producción se revisan antes de la implementación, con especial escrutinio para los cambios que tocan datos financieros o autenticación.</li>
      <li style={{ marginBottom: 6 }}><strong>Mejora planificada:</strong> Godroox está estableciendo un proceso de rutina para escanear las dependencias de la aplicación y los activos de producción en busca de vulnerabilidades conocidas y corregir los hallazgos en un cronograma definido. <strong>Plazo: hasta 90 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>10. Retención y Eliminación de Datos</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Los datos se conservan mientras una cuenta de cliente esté activa y según se requiera para fines legales, contables y de auditoría.</li>
      <li style={{ marginBottom: 6 }}>Tras el cierre de la cuenta, los datos de producción se eliminan después de una ventana de recuperación limitada; las copias de seguridad se sobrescriben de forma continua.</li>
      <li style={{ marginBottom: 6 }}><strong>Mejora planificada:</strong> Godroox está formalizando y automatizando su cronograma de retención y eliminación, incluyendo un período de retención definido para los logs de auditoría y un proceso documentado para atender solicitudes de eliminación. <strong>Plazo: hasta 90 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>11. Copia de Seguridad y Recuperación</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>La base de datos de producción está alojada en Railway, que proporciona copias de seguridad gestionadas a nivel de infraestructura.</li>
      <li style={{ marginBottom: 6 }}><strong>Mejora planificada:</strong> Godroox está documentando su configuración de copias de seguridad y el procedimiento de recuperación, y probará periódicamente la restauración de datos para confirmar la recuperabilidad. <strong>Plazo: hasta 60 días.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>12. Respuesta a Incidentes</h2>
    <p style={{ margin: '0 0 12px' }}>
      En caso de sospecha de un incidente de seguridad, Godroox sigue estos pasos:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      1. <strong>Contener:</strong> aislar el sistema afectado; si una implementación está implicada, revertir a la última versión estable conocida.<br />
      2. <strong>Evaluar:</strong> determinar el alcance y qué datos pueden haberse visto afectados.<br />
      3. <strong>Remediar:</strong> corregir la causa raíz y rotar cualquier credencial potencialmente expuesta.<br />
      4. <strong>Notificar:</strong> informar a las organizaciones clientes afectadas y, cuando lo exija la ley, a las personas y autoridades afectadas, sin demora indebida.<br />
      5. <strong>Revisar:</strong> documentar el incidente y las acciones correctivas tomadas.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      Godroox está formalizando este procedimiento en un plan escrito de respuesta a incidentes con plazos de notificación definidos. <strong>Plazo: hasta 60 días.</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>13. Autenticación de Usuario y Hoja de Ruta de MFA</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>El acceso administrativo a la infraestructura de producción está protegido por MFA a nivel de proveedor.</li>
      <li style={{ marginBottom: 6 }}>Las cuentas de usuario final en el Servicio se autentican actualmente con nombre de usuario y contraseña, con limitación de intentos contra fuerza bruta.</li>
      <li style={{ marginBottom: 6 }}><strong>Mejora planificada:</strong> Godroox está evaluando e intenta implementar autenticación multifactor para los usuarios finales, priorizando las cuentas que puedan vincular cuentas financieras a través de Plaid. <strong>Plazo: en evaluación; elemento de hoja de ruta.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>14. Privacidad</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox mantiene una Política de Privacidad pública que describe qué datos se recopilan, cómo se usan, con quién se comparten y los derechos de las personas. La Política de Privacidad está disponible en godmanager.us y se proporciona en inglés, portugués y español.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>15. Revisión de la Política</h2>
    <p style={{ margin: '0 0 12px' }}>
      Esta Política de Seguridad de la Información se revisa periódicamente y se actualiza a medida que el Servicio y sus controles evolucionan. Los cambios importantes se reflejan en la fecha de &quot;Última actualización&quot;.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>16. Contacto</h2>
    <p style={{ margin: '0 0 12px' }}>
      Para preguntas de seguridad o para reportar una vulnerabilidad o incidente:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC</strong><br />
      7480 Stone Creek Trail, Kissimmee, FL 34747, EE. UU.<br />
      Correo electrónico: <a href="mailto:contact@godmanager.us" style={{ color: '#c9a96e' }}>contact@godmanager.us</a>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <p style={{ margin: '0 0 12px' }}>
      *Este documento refleja los controles vigentes en la fecha de última actualización y las mejoras en curso con plazos previstos. Es mantenido internamente por Godroox LLC y tiene por objeto describir nuestro programa de seguridad de forma precisa y honesta.*
    </p>
    </>
  );
}
