// Same switch language used across the newer access screens: 44x24 track with
// a white knob. Plain button so callers control state and styling context.
const ToggleSwitch = ({ checked, disabled = false, onChange, label = "Toggle" }) => (
  <button
    type="button"
    role="switch"
    aria-checked={Boolean(checked)}
    aria-label={label}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      if (!disabled) onChange?.(!checked);
    }}
    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
      checked ? "bg-[#2563EB]" : "bg-slate-300"
    } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
        checked ? "left-[22px]" : "left-0.5"
      }`}
    />
  </button>
);

export default ToggleSwitch;
