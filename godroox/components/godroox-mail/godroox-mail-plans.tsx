'use client';

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

const PLANS = [
  {
    id: 'mailing',
    title: 'Virtual Mailing Address',
    subtitle: 'With digital mailbox for me and my family.',
    price: '$9.99',
    priceNote: '* per month',
    features: [
      'Get a real physical street address',
      'View and manage your mail and packages from anywhere',
      'Prevent mail and package theft',
      'Protect your privacy',
    ],
  },
  {
    id: 'business',
    title: 'Virtual Business Address',
    subtitle: 'With digital mailbox for my business.',
    price: '$14.99',
    priceNote: '* per month',
    features: [
      'Includes everything in Virtual Mailing Address plus:',
      'Get mail and packages in your business name',
      'Use it to register your business',
      'Upgrade your business image',
      'Optional office building address',
    ],
  },
  {
    id: 'office',
    title: 'Virtual Office',
    subtitle: 'With digital mailbox plus phone and fax.',
    price: '$39.99',
    priceNote: '* per month',
    features: [
      'Includes everything in Virtual Business Address plus:',
      'Local or toll-free phone and fax',
      'Call forwarding and voicemail',
    ],
  },
];

export function GodrooxMailPlans() {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col rounded-xl border border-blue-900/30 bg-[#1e3a5f] p-6 text-white shadow-lg"
        >
          <h3 className="text-xl font-bold">{plan.title}</h3>
          <p className="mt-2 text-sm text-blue-100">{plan.subtitle}</p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-3xl font-bold">Starting at {plan.price}</span>
            <span className="text-sm text-blue-200">{plan.priceNote}</span>
          </div>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-blue-50">
                <CheckIcon className="h-5 w-5 shrink-0 text-primary-400" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <a
            href="#cadastro"
            className="mt-6 block w-full rounded-lg bg-primary-500 py-3 text-center text-sm font-semibold text-white shadow transition hover:bg-primary-600"
          >
            Click to Learn More
          </a>
        </div>
      ))}
    </div>
  );
}
