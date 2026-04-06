# Teste da Página de Pagamentos Internacionais

## Verificação

A página está configurada corretamente:

1. ✅ `app/(marketing)/pagamentos-internacionais/page.tsx` - Server Component
2. ✅ `export const metadata` - Configurado corretamente
3. ✅ `components/payments/international-payment-form.tsx` - Client Component separado

## Como Testar

1. **Inicie o servidor:**
   ```bash
   ./start-docker.sh dev
   # ou
   npm run dev
   ```

2. **Acesse a página:**
   - http://localhost:8081/pagamentos-internacionais

3. **Verifique no navegador:**
   - Abra DevTools (F12)
   - Vá para a aba Console
   - Verifique se há erros

## Possíveis Problemas

### Se a página não carregar:

1. **Verifique se o servidor está rodando:**
   ```bash
   docker-compose -f docker-compose.dev.yml ps
   ```

2. **Verifique os logs:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs app
   ```

3. **Limpe o cache do Next.js:**
   ```bash
   rm -rf .next
   npm run dev
   ```

4. **Verifique se há erros de TypeScript:**
   ```bash
   npm run type-check
   ```

## Estrutura Correta

```
app/(marketing)/pagamentos-internacionais/
  └── page.tsx                    # Server Component (SEM 'use client')
                                  # COM export const metadata

components/payments/
  └── international-payment-form.tsx  # Client Component (COM 'use client')
                                      # SEM metadata
```

## Metadata

O metadata está exportado corretamente na página:

```typescript
export const metadata: Metadata = {
  title: 'International Payments',
  description: 'Send money internationally with competitive rates and low fees. Fast, secure, and transparent transactions.',
};
```
