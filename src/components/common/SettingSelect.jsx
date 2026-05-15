import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export function SettingSelect({ ariaLabel, onValueChange, options, value }) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className="setting-select-trigger" aria-label={ariaLabel}>
        <Select.Value className="setting-select-value" />
        <Select.Icon asChild>
          <ChevronDown aria-hidden="true" size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="setting-select-content" position="popper" sideOffset={6}>
          <Select.Viewport className="setting-select-viewport">
            {options.map((option) => (
              <Select.Item className="setting-select-item" key={option.value} value={option.value}>
                <Select.ItemText>
                  <span className="setting-select-item-text">{option.label}</span>
                </Select.ItemText>
                <Select.ItemIndicator className="setting-select-indicator">
                  <Check aria-hidden="true" size={13} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
