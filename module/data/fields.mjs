/**
 * Data field that automatically selects the Advancement-specific configuration or value data models.
 *
 * @param {Advancement} advancementType  Advancement class to which this field belongs.
 */
export class AdvancementDataField extends foundry.data.fields.ObjectField {
  constructor(advancementType, options={}) {
    super(options);
    this.advancementType = advancementType;
  }

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {required: true});
  }

  getModel() {
    return this.advancementType.metadata?.dataModels?.[this.name];
  }

  getDefaults() {
    return this.advancementType.metadata?.defaults?.[this.name] ?? {};
  }

  _cleanType(value, options) {
    if ( !(typeof value === "object") ) value = {};

    // Use a defined DataModel
    const cls = this.getModel();
    if ( cls ) return cls.cleanData(value, options);
    if ( options.partial ) return value;

    // Use the defined defaults
    const defaults = this.getDefaults();
    return foundry.utils.mergeObject(defaults, value, {inplace: false});
  }

  initialize(value, model) {
    const cls = this.getModel();
    if ( cls ) return new cls(value, {parent: model});
    return foundry.utils.deepClone(value);
  }
}

/* -------------------------------------------- */

/**
 * @typedef {StringFieldOptions} FormulaFieldOptions
 * @property {boolean} [deterministic=false]  Is this formula not allowed to have dice values?
 */

/**
 * Special case StringField which represents a formula.
 *
 * @param {FormulaFieldOptions} [options={}]  Options which configure the behavior of the field.
 * @property {boolean} deterministic=false    Is this formula not allowed to have dice values?
 */
export class FormulaField extends foundry.data.fields.StringField {

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      deterministic: false
    });
  }

  /** @inheritdoc */
  _validateType(value) {
    const roll = new Roll(value);
    if ( this.options.deterministic ) {
      if ( !roll.isDeterministic ) throw new Error("must not contain dice terms");
      Roll.safeEval(roll.formula);
    } else {
      roll.evaluate({async: false});
    }
    super._validateType(value);
  }

}

/* -------------------------------------------- */

/**
 * Special case StringField that includes automatic validation for identifiers.
 */
export class IdentifierField extends foundry.data.fields.StringField {
  /** @override */
  _validateType(value) {
    if ( !dnd5e.utils.validators.isValidIdentifier(value) ) {
      throw new Error(game.i18n.localize("DND5E.IdentifierError"));
    }
  }
}

/* -------------------------------------------- */

/**
 * @typedef {DataFieldOptions} MappingFieldOptions
 * @property {string[]} [initialKeys]  Keys that will be created if no data is provided.
 */

/**
 * A subclass of ObjectField that represents a mapping of keys to the provided DataField type.
 *
 * @param {DataField} type                     The class of DataField which should be embedded in this field.
 * @param {MappingFieldOptions} [options={}]   Options which configure the behavior of the field.
 * @property {string[]} [initialKeys]          Keys that will be created if no data is provided.
 */
export class MappingField extends foundry.data.fields.ObjectField {
  constructor(model, options) {
    if ( !(model instanceof foundry.data.fields.DataField) ) {
      throw new Error("MappingField must have a DataField as its contained element");
    }
    super(options);

    /**
     * The embedded DataField definition which is contained in this field.
     * @type {DataField}
     */
    this.model = model;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      initialKeys: undefined
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cleanType(value, options) {
    Object.values(value).forEach(v => this.model.clean(v, options));
    return value;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getInitialValue(data) {
    let keys = this.initialKeys;
    const initial = super.getInitialValue(data);
    if ( !keys || !foundry.utils.isEmpty(initial) ) return initial;
    if ( !(keys instanceof Array) ) keys = Object.keys(keys);
    for ( const key of keys ) initial[key] = this.model.getInitialValue();
    return initial;
  }

  /* -------------------------------------------- */

  /** @override */
  _validateType(value, options={}) {
    if ( foundry.utils.getType(value) !== "Object" ) throw new Error("must be an Object");
    const errors = this._validateValues(value, options);
    if ( !foundry.utils.isEmpty(errors) ) throw new foundry.data.fields.ModelValidationError(errors);
  }

  /* -------------------------------------------- */

  /**
   * Validate each value of the object.
   * @param {object} value     The object to validate.
   * @param {object} options   Validation options.
   * @returns {Object<Error>}  An object of value-specific errors by key.
   */
  _validateValues(value, options) {
    const errors = {};
    for ( const [k, v] of Object.entries(value) ) {
      const error = this.model.validate(v, options);
      if ( error ) errors[k] = error;
    }
    return errors;
  }

  /* -------------------------------------------- */

  /** @override */
  initialize(value, model) {
    if ( !value ) return value;
    Object.values(value).forEach(v => this.model.initialize(v, model));
    return value;
  }
}