import React from 'react';
import {TextInput} from 'react-native';
import {TextInput as PaperTextInput} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import {Picker} from '@react-native-picker/picker';
import {DocumentPickerOptions, getDocumentAsync} from 'expo-document-picker';

import StringUtils from '@utils/StringUtils';
import ValidationUtils, {Rule} from '@utils/ValidationUtils';

type Rules<T> = {[K in keyof T]: Rule[]};

type FormErrors<T> = {[K in keyof T]: string | null};

// More specific ref types that cover common form components
type FormRefTypes = React.ComponentRef<typeof TextInput> | React.ComponentRef<typeof PaperTextInput> | React.ComponentRef<typeof Picker> | null;

type FormRefs<T> = {[K in keyof T]: FormRefTypes};

type ExtractFieldRules<R extends Rule[]> = R[number];

type Messages<T> = {
  [K in keyof T]?: Partial<{
    [R in ExtractFieldRules<Rules<T>[K]>]: string;
  }>;
};

export default function useForm<T extends Record<string, any>>({
  rules,
  initialFields,
  OnSubmit,
  messages,
}: {
  rules?: Rules<T>;
  initialFields: T;
  messages?: Messages<T>;
  OnSubmit: () => void;
}) {
  const Validator = new ValidationUtils();

  /**
   * Initializes error states for the form fields
   * @param fields The initial fields to create error states for
   * @returns A mapping of field names to their error messages
   */
  const InitializeErrors = (fields: T): FormErrors<T> => {
    return Object.keys(fields).reduce((acc, key) => {
      acc[key as keyof T] = null;
      return acc;
    }, {} as FormErrors<T>);
  };

  /**
   * Initializes refs for the form fields
   * @param fields The initial fields to create refs for
   * @returns A mapping of field names to their refs
   */
  const InitializeRefs = <T extends Record<string, any>>(fields: T): FormRefs<T> => {
    return Object.keys(fields).reduce((acc, key) => {
      acc[key as keyof T] = null;
      return acc;
    }, {} as FormRefs<T>);
  };

  const refs = React.useRef(InitializeRefs(initialFields));
  const setRef = (key: keyof typeof initialFields) => (ref: FormRefTypes) => {
    refs.current[key] = ref;
  };

  const [fields, setFields] = React.useState(initialFields);
  const [errors, setErrors] = React.useState(InitializeErrors(initialFields));

  /**
   * Method that handles changes to a specific form field
   * @param key The key of the field being changed
   * @param value The new value of the field
   */
  const HandleFieldChange = (key: keyof T, value: any) => {
    setFields(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * Helper function to get validation error message
   * @param field Field name
   * @param rule Validation rule
   * @param result Validation result
   * @returns Error message or null
   */
  const getErrorMessage = (field: keyof T, rule: Rule, result: {isValid: boolean; message: string | null}) => {
    if (result.isValid) return null;

    // Use custom message if provided
    const customMessage = messages?.[field]?.[rule as ExtractFieldRules<Rules<T>[keyof T]>];
    if (customMessage) return customMessage;

    // Use default validation message
    return StringUtils.formatString(result.message ?? '');
  };

  /**
   * Method that validates a specific field
   * @param field The field to validate
   * @returns boolean indicating if the field is valid
   */
  const ValidateField = (field: keyof T) => {
    if (rules && field in rules) {
      const isValid = rules[field].every(rule => {
        const result = Validator.Validate(String(field), rule, fields?.[field] ?? '');
        setErrors(prev => ({
          ...prev,
          [field]: getErrorMessage(field, rule, result),
        }));
        return result.isValid;
      });
      return isValid;
    }
    return true;
  };

  /**
   * Method that validates all fields and calls OnSubmit if all are valid
   */
  const HandleSubmit = () => {
    const isValid = Object.keys(fields).map(field => {
      const fieldKey = field as keyof T;
      if (rules && fieldKey in rules) {
        return ValidateField(fieldKey);
      }
      return true;
    });

    if (isValid.every(item => item)) OnSubmit();
  };

  /**
   * Method that picks a document from the device
   * @param field The field to update with the picked document
   * @param pickOptions Options for the document picker
   */
  const PickDocument = (field: keyof T, pickOptions: DocumentPickerOptions) => {
    getDocumentAsync(pickOptions).then(document => {
      if (document.assets && document.assets?.length > 0) {
        setFields(prev => ({
          ...prev,
          [field]: {
            uri: document.assets[0].uri,
            type: document.assets[0].mimeType,
            name: document.assets[0].name,
          },
        }));
      }
    });
  };

  /**
   * Method that picks an image from the device
   * @param field The field to update with the picked image
   * @param options Options for the image picker
   */
  const PickImage = (field: keyof T, options: ImagePicker.ImagePickerOptions) => {
    ImagePicker.launchImageLibraryAsync(options).then(document => {
      if (!document.canceled && document.assets && document.assets.length > 0) {
        setFields(prev => ({
          ...prev,
          [field]: {
            uri: document.assets[0].uri,
            type: document.assets[0].mimeType,
            name: document.assets[0].fileName ?? 'image.jpg',
          },
        }));
      }
    });
  };

  React.useEffect(() => {
    setFields(prev => ({
      ...prev,
      ...initialFields,
    }));
  }, [JSON.stringify(initialFields)]);

  return {
    refs,
    fields,
    errors,
    setRef,
    PickImage,
    PickDocument,
    ValidateField,
    HandleSubmit,
    HandleFieldChange,
  };
}
