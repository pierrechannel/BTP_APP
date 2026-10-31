import { forwardRef } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

function fieldPlaceholder(props: TextFieldProps): string {
  const label = typeof props.label === 'string' ? props.label : String(props.inputProps?.['aria-label'] || '');
  const name = label.toLocaleLowerCase('fr');
  if (props.select) return label ? `Sélectionner : ${label}` : 'Sélectionner une option';
  if (props.type === 'email' || /e-?mail|courriel/.test(name)) return 'exemple@entreprise.com';
  if (props.type === 'password') return 'Saisissez votre mot de passe';
  if (/téléphone|telephone|phone/.test(name)) return '+257 79 00 00 00';
  if (/prénom/.test(name)) return 'Ex. : Jean';
  if (/nom de famille|^nom$/.test(name)) return 'Ex. : Ndayishimiye';
  if (/devise/.test(name)) return 'Ex. : BIF';
  if (/quantité/.test(name)) return 'Ex. : 1';
  if (props.type === 'number') return 'Ex. : 0';
  if (props.type === 'date') return 'jj/mm/aaaa';
  if (props.type === 'datetime-local') return 'jj/mm/aaaa hh:mm';
  if (props.type === 'time') return 'hh:mm';
  if (/recherch/.test(name)) return label;
  return label ? `Saisir : ${label}` : 'Saisissez une valeur';
}

/** Shared placeholders for forms, including empty selectors and relation inputs. */
export const FormTextField = forwardRef<HTMLDivElement, TextFieldProps>(function FormTextField(props, ref) {
  const placeholder = props.placeholder ?? fieldPlaceholder(props);
  const emptySelect = props.select && (props.value === '' || props.value == null);
  return <TextField {...props} ref={ref} placeholder={placeholder}
    InputLabelProps={{ shrink: true, ...props.InputLabelProps }}
    SelectProps={{ ...props.SelectProps, displayEmpty: true, ...(emptySelect && !props.SelectProps?.renderValue ? { renderValue: () => <span style={{ opacity: .55 }}>{placeholder}</span> } : {}) }} />;
});
