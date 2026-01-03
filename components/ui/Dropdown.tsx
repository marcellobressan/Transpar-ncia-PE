import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  align = 'left',
}) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button as={Fragment}>{trigger}</Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className={cn(
            'absolute mt-2 w-56 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50 py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item) => (
            <Menu.Item key={item.value} disabled={item.disabled}>
              {({ active }) => (
                <button
                  onClick={() => onSelect(item.value)}
                  className={cn(
                    'group flex w-full items-center gap-2 px-4 py-2.5 text-sm',
                    active && 'bg-slate-50',
                    item.disabled && 'opacity-50 cursor-not-allowed',
                    item.danger ? 'text-red-600' : 'text-slate-700'
                  )}
                >
                  {item.icon && (
                    <span className="w-4 h-4 text-slate-400 group-hover:text-slate-600">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  className,
}) => {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Dropdown
      align="left"
      trigger={
        <button
          className={cn(
            'flex items-center justify-between gap-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm',
            'hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'transition-all duration-200',
            className
          )}
        >
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      }
      items={options.map((opt) => ({ ...opt, value: opt.value }))}
      onSelect={onChange}
    />
  );
};

export default Dropdown;
