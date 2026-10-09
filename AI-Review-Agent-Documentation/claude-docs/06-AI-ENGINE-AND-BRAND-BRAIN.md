# AI Engine and Brand Brain

## Brand Brain
Structured settings: business info; personality presets/combinations; reply length; customer-name use; emoji preference; primary/additional languages; reviewer-language behavior; negative-review rules; prohibited promises/phrases; merchant-supplied examples; location overrides; version history.

## Pipeline
Validate -> load Brand Brain -> analyze review -> language -> deterministic risk -> rules -> prompt -> provider gateway -> structured output -> schema validation -> promise/hallucination guard -> repetition guard -> draft -> human -> PublishService.

## Risk
Normal, Complaint, Serious Complaint, Safety, Legal Threat, Discrimination, Harassment, Fraud allegation, Medical/health, Employee accusation, Refund/payment dispute, Privacy/PII. Higher risk wins; sensitive categories require manual review.

## Providers
`AIProvider` supports structured/text/classify/health and provider configs by purpose. Initial provider is configurable; customers control outcome, not model. No proprietary LLM V1.

## Learning
Never silently learn edits. Observations progress OBSERVING -> SUGGESTED -> CONFIRMED or DISMISSED. Merchant confirmation is required. Google content is not a hidden permanent training corpus. Roman Urdu/mixed language supported when configured.
