'use client';

import { Input } from '@/components/ui/input';

interface POBoxCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  poBoxNumber: string;
  onPOBoxNumberChange: (value: string) => void;
  error?: string;
}

export function POBoxCheckbox({
  checked,
  onCheckedChange,
  poBoxNumber,
  onPOBoxNumberChange,
  error,
}: POBoxCheckboxProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-start cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-1 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="ml-3">
          <span className="text-sm font-medium text-secondary-900">
            Use PO Box for mail forwarding
          </span>
          <p className="text-xs text-secondary-600 mt-1">
            We'll receive your correspondence and forward it to you. Perfect for privacy and convenience. Available for LLC, Insurance, and Payment services.
          </p>
        </div>
      </label>

      {checked && (
        <div className="ml-7">
          <Input
            label="PO Box Number"
            type="text"
            value={poBoxNumber}
            onChange={(e) => onPOBoxNumberChange(e.target.value)}
            error={error}
            placeholder="Enter PO Box number"
            required={checked}
          />
          <p className="text-xs text-secondary-500 mt-1">
            We'll set up a PO Box and forward all mail to your registered address.
          </p>
        </div>
      )}
    </div>
  );
}
