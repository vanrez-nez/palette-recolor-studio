import * as Tooltip from "@radix-ui/react-tooltip";

export function TooltipButton({ children, tooltip, ...buttonProps }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button {...buttonProps}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip-content" sideOffset={6}>
          {tooltip}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
