import { createContext } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

export type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

export type FormItemContextValue = {
  id: string;
};

export const FormFieldContext = createContext<FormFieldContextValue | null>(null);
export const FormItemContext = createContext<FormItemContextValue | null>(null);
