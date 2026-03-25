
## What 
- eval library that run LLM as a judge eval 

## Requirements 
- Prompt catalog has N already made prompt (e.g Toxicty, faithfulness etc)
- Eval engine function 
  - FUNCTION that take off as input 
    - input , output and sometiems context or expected output (depends)
    - Provider for now we will only limit 2 Openai and anthropic 
    - run an async client to call an LLM for the evaluation 
- Eval output will be the same 
  - ```{
  "score": { "value": <float 0–1>, "label": "pass | fail" },
  "explanation": { "summary": "<1-2 sentences>", ...metric-specific fields }
}```
- prompts will be stored in a json file 
  - each prompt has a name, id, a version, prompt field where the text is defined, and a scoring system attached

- 2 nd function is a create custom prompt that TBD where to be stored but basicly user can create an name , prompt and scoring system 
- we will provide some scoring out of the box like ),1 1-5 etc but user can create his own 


## Notes 
- This should be in TS 
- Best practice should be applied especially but not only for the eval engine (async, error handling, show right error, config timeout etc)
- This should be minimal idk any complex stuff must be easy for the user to use 

