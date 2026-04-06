import { GodrooxMailPlans } from '@/components/godroox-mail/godroox-mail-plans';
import { GodrooxMailForm } from '@/components/godroox-mail/godroox-mail-form';

export const metadata = {
  title: 'Godroox Mail | Endereço na Florida',
  description: 'Tenha um endereço na Florida. Caixa postal virtual, endereço comercial e escritório virtual com plano mensal.',
};

export default function GodrooxMailPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Godroox Mail
              <span className="block text-primary-600">
                Tenha um endereço na Florida
              </span>
            </h1>
            <p className="body-large mb-8">
              Endereço físico real na Florida para você e sua família ou para sua empresa. 
              Receba correspondência e encomendas, gerencie tudo online e proteja sua privacidade.
            </p>
            <a
              href="#planos"
              className="inline-block rounded-lg bg-primary-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-700"
            >
              Ver planos
            </a>
          </div>
        </div>
      </section>

      {/* Plans - Online Virtual PO Box Plans */}
      <section id="planos" className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="text-center mb-14">
            <h2 className="heading-2 text-secondary-900 mb-4">
              Planos de Caixa Postal Virtual
            </h2>
            <p className="body-large text-secondary-600">
              Escolha o plano ideal para receber sua correspondência na Florida.
            </p>
          </div>
          <GodrooxMailPlans />
        </div>
      </section>

      {/* Formulário de cadastro */}
      <section id="cadastro" className="py-20 bg-white">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl">
            <div className="text-center mb-10">
              <h2 className="heading-2 text-secondary-900 mb-3">
                Cadastre-se no Godroox Mail
              </h2>
              <p className="body-large text-secondary-600">
                Preencha o formulário e nossa equipe entrará em contato para ativar seu endereço na Florida.
              </p>
            </div>
            <GodrooxMailForm />
          </div>
        </div>
      </section>
    </>
  );
}
