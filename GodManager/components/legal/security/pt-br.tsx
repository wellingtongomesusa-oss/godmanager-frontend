export function SecurityContentPtBr() {
  return (
    <>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC — Plataforma GodManager</strong><br />
      <strong>Responsável: Wellington Alves Gomes, Owner, Godroox LLC</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>1. Objetivo e Escopo</h2>
    <p style={{ margin: '0 0 12px' }}>
      Esta Política de Segurança da Informação descreve como a Godroox LLC (&quot;Godroox&quot;) protege a confidencialidade, a integridade e a disponibilidade das informações tratadas pela plataforma GodManager (&quot;o Serviço&quot;). Aplica-se a todos os sistemas, dados, pessoas e serviços de terceiros envolvidos na operação do Serviço.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      O GodManager é uma plataforma de gestão de propriedades em modelo software-as-a-service para empresas de gestão de propriedades nos Estados Unidos. Trata dados empresariais e pessoais, incluindo registros de propriedades, informações de inquilinos e proprietários, transações financeiras e — quando um usuário opta por conectar uma conta bancária — tokens de conta financeira criptografados obtidos pela Plaid.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      Este documento descreve tanto os controles atualmente implementados quanto as melhorias planejadas ou em andamento, com prazos previstos. A Godroox trata a segurança da informação como um programa contínuo de melhoria.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>2. Organização e Responsabilidade</h2>
    <p style={{ margin: '0 0 12px' }}>
      A Godroox é uma organização pequena. O Owner, Wellington Alves Gomes, é responsável pelas decisões de segurança da informação, incluindo gestão de acesso, seleção de fornecedores, resposta a incidentes e aprovação de mudanças nos sistemas de produção.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      O acesso aos sistemas é limitado ao Owner e a um pequeno número de contratados verificados, engajados para tarefas específicas de desenvolvimento. O acesso é concedido com base no princípio do menor privilégio e revogado quando não é mais necessário.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>3. Controle de Acesso</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Autenticação:</strong> os usuários se autenticam com um nome de usuário (e-mail) e senha. As senhas são armazenadas com hashing unidirecional bcrypt (12 rounds); senhas em texto puro nunca são armazenadas.</li>
      <li style={{ marginBottom: 6 }}><strong>Gestão de sessão:</strong> as sessões autenticadas usam um cookie seguro do tipo HTTP-only. Em produção, o cookie de sessão é marcado como Secure (transmitido apenas por HTTPS) e SameSite, para mitigar riscos entre sites. As sessões expiram após 24 horas.</li>
      <li style={{ marginBottom: 6 }}><strong>Proteção contra força bruta:</strong> as tentativas de login são limitadas (um número máximo de tentativas por janela de tempo, com bloqueio temporário) para deter adivinhação automatizada de senhas.</li>
      <li style={{ marginBottom: 6 }}><strong>Controle de acesso baseado em função:</strong> o Serviço define funções de usuário distintas (administrador, gerente, contador, locação, manutenção, campo, visualizador, proprietário, inquilino, fornecedor e superadministrador da plataforma). O acesso a recursos e dados é controlado por função e por permissões por seção.</li>
      <li style={{ marginBottom: 6 }}><strong>Isolamento entre inquilinos:</strong> o Serviço é multi-inquilino. Os dados de cada organização cliente são delimitados por um identificador de cliente, de modo que os usuários acessem apenas os dados pertencentes à sua organização. O isolamento por linha no banco de dados fornece defesa em profundidade.</li>
      <li style={{ marginBottom: 6 }}><strong>Acesso administrativo:</strong> o acesso à infraestrutura de produção (hospedagem, banco de dados, armazenamento, repositório de código) é restrito ao Owner e protegido por autenticação multifator (MFA) em cada conta de provedor. As credenciais são armazenadas em um gerenciador de senhas, não em texto puro nem no código.</li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>4. Proteção de Dados e Criptografia</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Criptografia em trânsito:</strong> todo o tráfego entre clientes e o Serviço é servido por HTTPS/TLS pelos provedores de hospedagem e de borda.</li>
      <li style={{ marginBottom: 6 }}><strong>Criptografia de credenciais sensíveis em repouso:</strong> os tokens de acesso a contas bancárias obtidos pela Plaid são criptografados na camada de aplicação com AES-256-GCM antes de serem armazenados. A chave de criptografia é mantida apenas na configuração do ambiente de produção e nunca é incluída no controle de versão.</li>
      <li style={{ marginBottom: 6 }}><strong>Hashing de senhas:</strong> como acima, o bcrypt é usado para todas as senhas de conta.</li>
      <li style={{ marginBottom: 6 }}><strong>Sem armazenamento de dados de cartão:</strong> a Godroox não armazena números completos de cartão de pagamento. Os pagamentos de assinatura com cartão são tratados pela Stripe.</li>
      <li style={{ marginBottom: 6 }}><strong>Banco de dados e armazenamento:</strong> o banco de dados de produção (PostgreSQL) e o armazenamento de objetos (Cloudflare R2) são hospedados por provedores reconhecidos que aplicam criptografia em repouso no nível de infraestrutura.</li>
    </ul>
    <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Melhorias planejadas (proteção de dados)</h3>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Criptografia de campos sensíveis adicionais:</strong> certos campos sensíveis inseridos pelas organizações clientes (por exemplo, SSN/ITIN de inquilino e dados de conta bancária de fornecedor) são atualmente armazenados em texto puro dentro do banco de dados isolado por inquilino. A Godroox está implementando criptografia na camada de aplicação (usando o mesmo mecanismo AES-256-GCM já em uso para tokens da Plaid) para esses campos. <strong>Prazo: até 60 dias.</strong></li>
      <li style={{ marginBottom: 6 }}><strong>Tokens de sessão assinados:</strong> a Godroox está atualizando os cookies de sessão para usar assinatura criptográfica (HMAC) a fim de proteger ainda mais a integridade da sessão. <strong>Prazo: até 60 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>5. Segurança de Rede e Transporte</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>O Serviço é entregue por HTTPS/TLS pela plataforma de hospedagem (Railway) e pelo provedor de borda/CDN (Cloudflare).</li>
      <li style={{ marginBottom: 6 }}>A Godroox está adicionando cabeçalhos de resposta HTTP de segurança (incluindo HTTP Strict Transport Security, X-Content-Type-Options, X-Frame-Options e Referrer-Policy) na camada de aplicação para reforçar o HTTPS e reduzir riscos web comuns. <strong>Prazo: até 30 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>6. Registro, Monitoramento e Auditoria</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Registro de auditoria:</strong> ações importantes (como exclusões de registros, atualizações de saldo, mudanças de senha e alterações de documentos financeiros) são registradas em um log de auditoria que captura o autor, data/hora, endereço IP, user agent e contexto relevante.</li>
      <li style={{ marginBottom: 6 }}><strong>Monitoramento da aplicação:</strong> erros da aplicação e eventos operacionais são registrados pela plataforma de hospedagem.</li>
      <li style={{ marginBottom: 6 }}><strong>Melhoria planejada:</strong> a Godroox está expandindo a cobertura de auditoria para operações sensíveis adicionais e definindo um período de retenção de logs. <strong>Prazo: até 90 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>7. Gestão de Fornecedores e Suboperadores</h2>
    <p style={{ margin: '0 0 12px' }}>
      A Godroox depende de provedores terceiros estabelecidos e reconhecidos, cada um tratando apenas os dados necessários para sua função:
    </p>
    <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginTop: 12, marginBottom: 16, fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Provedor</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Função</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Notas</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Railway</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Hospedagem da aplicação e banco PostgreSQL</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Estados Unidos</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Cloudflare R2</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Armazenamento de objetos (fotos, documentos)</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Criptografia em repouso</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Stripe</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Processamento de pagamentos de assinatura</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Conforme PCI; sem armazenamento de dados de cartão pela Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Plaid</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Verificação e vinculação de contas bancárias</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Produtos Auth e Identity; tokens de acesso criptografados pela Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Resend</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Entrega de e-mails transacionais</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Crisp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Chat no site de marketing</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Ramp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Integração de cartão corporativo / despesas</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Intuit QuickBooks</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Integração contábil opcional</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Habilitada por cliente</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Anthropic</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Recursos assistidos por IA</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
      </tbody>
    </table>
    <p style={{ margin: '0 0 12px' }}>
      A Godroox seleciona fornecedores que mantêm práticas de segurança reconhecidas e revisa esta lista periodicamente.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>8. Integração com a Plaid — Escopo e Tratamento</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>A Godroox usa os produtos <strong>Auth</strong> e <strong>Identity</strong> da Plaid para verificar e vincular contas bancárias a pedido do usuário.</li>
      <li style={{ marginBottom: 6 }}>A Godroox <strong>não</strong> usa a Plaid para movimentar dinheiro, iniciar pagamentos ou obter histórico de transações.</li>
      <li style={{ marginBottom: 6 }}>A Godroox <strong>não</strong> recebe nem armazena credenciais de banco online dos usuários; estas são tratadas exclusivamente pela Plaid.</li>
      <li style={{ marginBottom: 6 }}>Os dados recebidos da Plaid (tokens de acesso e metadados limitados da conta) são tratados como sensíveis. Os tokens de acesso são criptografados em repouso (AES-256-GCM). Apenas os últimos dígitos de um número de conta (a máscara) são retidos para exibição.</li>
      <li style={{ marginBottom: 6 }}>Os usuários podem desconectar uma conta vinculada; a Godroox está adicionando um fluxo de desconexão/revogação self-service. <strong>Prazo: até 60 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>9. Gestão de Vulnerabilidades</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>A Godroox depende de infraestrutura gerenciada e atualizada de seus provedores de hospedagem e plataforma, e mantém as dependências da aplicação atualizadas.</li>
      <li style={{ marginBottom: 6 }}>As mudanças de código que afetam a produção são revisadas antes da implantação, com escrutínio especial para mudanças que tocam dados financeiros ou autenticação.</li>
      <li style={{ marginBottom: 6 }}><strong>Melhoria planejada:</strong> a Godroox está estabelecendo um processo de rotina para varrer dependências da aplicação e ativos de produção em busca de vulnerabilidades conhecidas e corrigir as constatações em um cronograma definido. <strong>Prazo: até 90 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>10. Retenção e Exclusão de Dados</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Os dados são retidos enquanto uma conta de cliente estiver ativa e conforme exigido para fins legais, contábeis e de auditoria.</li>
      <li style={{ marginBottom: 6 }}>Após o encerramento da conta, os dados de produção são excluídos após uma janela de recuperação limitada; os backups são sobrescritos de forma contínua.</li>
      <li style={{ marginBottom: 6 }}><strong>Melhoria planejada:</strong> a Godroox está formalizando e automatizando seu cronograma de retenção e exclusão, incluindo um período de retenção definido para logs de auditoria e um processo documentado para atender a pedidos de exclusão. <strong>Prazo: até 90 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>11. Backup e Recuperação</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>O banco de dados de produção é hospedado na Railway, que fornece backups gerenciados no nível de infraestrutura.</li>
      <li style={{ marginBottom: 6 }}><strong>Melhoria planejada:</strong> a Godroox está documentando sua configuração de backup e o procedimento de recuperação, e testará periodicamente a restauração de dados para confirmar a recuperabilidade. <strong>Prazo: até 60 dias.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>12. Resposta a Incidentes</h2>
    <p style={{ margin: '0 0 12px' }}>
      Em caso de suspeita de incidente de segurança, a Godroox segue estes passos:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      1. <strong>Conter:</strong> isolar o sistema afetado; se uma implantação estiver implicada, reverter para a última versão estável conhecida.<br />
      2. <strong>Avaliar:</strong> determinar o escopo e quais dados podem ter sido afetados.<br />
      3. <strong>Remediar:</strong> corrigir a causa raiz e rotacionar quaisquer credenciais potencialmente expostas.<br />
      4. <strong>Notificar:</strong> informar as organizações clientes afetadas e, quando exigido por lei, os indivíduos e autoridades afetados, sem demora indevida.<br />
      5. <strong>Revisar:</strong> documentar o incidente e as ações corretivas tomadas.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      A Godroox está formalizando este procedimento em um plano escrito de resposta a incidentes com prazos de notificação definidos. <strong>Prazo: até 60 dias.</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>13. Autenticação de Usuário e Roadmap de MFA</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>O acesso administrativo à infraestrutura de produção é protegido por MFA no nível do provedor.</li>
      <li style={{ marginBottom: 6 }}>As contas de usuário final no Serviço autenticam atualmente com nome de usuário e senha, com limitação de tentativas contra força bruta.</li>
      <li style={{ marginBottom: 6 }}><strong>Melhoria planejada:</strong> a Godroox está avaliando e pretende implementar autenticação multifator para usuários finais, priorizando contas que possam vincular contas financeiras pela Plaid. <strong>Prazo: em avaliação; item de roadmap.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>14. Privacidade</h2>
    <p style={{ margin: '0 0 12px' }}>
      A Godroox mantém uma Política de Privacidade pública que descreve quais dados são coletados, como são usados, com quem são compartilhados e os direitos dos indivíduos. A Política de Privacidade está disponível em godmanager.us e é fornecida em inglês, português e espanhol.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>15. Revisão da Política</h2>
    <p style={{ margin: '0 0 12px' }}>
      Esta Política de Segurança da Informação é revisada periodicamente e atualizada conforme o Serviço e seus controles evoluem. Alterações relevantes são refletidas na data de &quot;Última atualização&quot;.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>16. Contato</h2>
    <p style={{ margin: '0 0 12px' }}>
      Para questões de segurança ou para relatar uma vulnerabilidade ou incidente:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC</strong><br />
      7480 Stone Creek Trail, Kissimmee, FL 34747, EUA<br />
      E-mail: <a href="mailto:contact@godmanager.us" style={{ color: '#c9a96e' }}>contact@godmanager.us</a>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <p style={{ margin: '0 0 12px' }}>
      *Este documento reflete os controles em vigor na data da última atualização e as melhorias em andamento com prazos previstos. É mantido internamente pela Godroox LLC e tem por objetivo descrever nosso programa de segurança de forma precisa e honesta.*
    </p>
    </>
  );
}
