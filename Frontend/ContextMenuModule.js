import React, { useState, useEffect } from 'react';
import { invoke, view } from '@forge/bridge';
import { Field } from '@atlaskit/form';
import { Flex, Grid, xcss } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import UnlockIcon from '@atlaskit/icon/glyph/unlock';
import LockIcon from '@atlaskit/icon/glyph/lock';
import Textfield from '@atlaskit/textfield';
import { Alert } from '@mui/material';
import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LinearProgress from '@mui/material/LinearProgress';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import './ContextMenuModule.css';

// Styles for grid and title container
const gridStyles = xcss({
  width: '100%',
});
const titleContainerStyles = xcss({
  gridArea: 'title',
});

function ContextMenuModule() {

  //State management
  const [text, setText] = useState('');
  const [isTextFetched, setIsTextFetched] = useState(false);

  const [generatedFlashcards, setGeneratedFlashcards] = useState([]);
  const [front, setFront] = useState([]);
  const [back, setBack] = useState([]);
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);

  const [autoGenTag, setAutoGenTag] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);


  //fetching the selected text from the page when the module initally loads
  useEffect(() => {
    const fetchData = async () => {
      try {
        const context = await view.getContext();
        const selectedText = context.extension.selectedText; //get selected text from confluence
        if (selectedText.length > 1000) {
          setShowWarning(true);
        } else {
          setText(selectedText);
          setIsTextFetched(true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Fetch or create the "auto-generated" tag
  useEffect(() => {
    const fetchTag = async () => {
      try {
        const tags = await invoke('getAllTags', {});
        const autoGeneratedTag = tags.tags.find(tag => tag.title === 'auto-generated');
        if (autoGeneratedTag) {
          setAutoGenTag(autoGeneratedTag);
        } else {
          const newTag = await invoke('createTag', { title: 'auto-generated', colour: 'blue'});
          setAutoGenTag(newTag);
        }

      } catch (error) {
        console.error('Could not fetch or create the tag', error);
      }
    }
    fetchTag();
  }, []);

  // Trigger flashcard generation when text is fetched with no errors
  useEffect(() => {

    if (isTextFetched) {
      handleGenerateFlashcards();
    }
  }, [isTextFetched]);

  // Function to generate flashcards using AI
  const handleGenerateFlashcards = async () => {

    setLoading(true);

    try {
      const response = await invoke('generateQA', { text:text });

      //useful log to test ai responce
      console.log("Received response from 'generateQA':", response);

      //if successful responce from AI backend
      if (response && response.success) {
        setGeneratedFlashcards(response.data);
        setFront(response.data.map(fc => fc.question || ''));
        setBack(response.data.map(fc => fc.answer || ''));
      } else {
        console.log("Error Generating Flashcards:", response.error);
      }
    } catch (error) {
      setShowTimeoutWarning(true);
      console.error("Exception in handleGenerateFlashcards:", error);
    } finally {
      setLoading(false);
      console.log("Finished Flashcard Generation. Loading State:", loading);
    }

  };

  //handle saving each flashcard in the context menu popup
  const handleSaveFlashcard = async (flashcard, index) => {

    try {

      //create the flashcard
      const response = await invoke('createFlashcard', {
        front: front[index],
        back: back[index],
        hint: hint,
        locked: locked
      });

      //handling responce from create flashcard
      if (response && response.success) {
        setSaveSuccess(true);

        //adding the autogenerated tag
        const res = await invoke('addTagToCard', {
          cardId: response.id,
          tagId: autoGenTag.id
        });
        // Display success message briefly
        setTimeout(() => setSaveSuccess(false), 1000);

        setTimeout(() => {
          setFront(front.filter((_, i) => i !== index));
          setBack(back.filter((_, i) => i !== index));
          setHint('');
          setLocked(false);
          setGeneratedFlashcards(generatedFlashcards.filter(fc => fc !== flashcard));
        }, 1000); // Delay of 1 second (1000 ms)
      } else {
        console.log("Error Saving Flashcard:", response.error);
      }
    } catch (error) {
      console.error("Exception in handleSaveFlashcard:", error);
    }

  };

  return (
    <div className='context-menu'>
       {/************************************* HEADER SECTION ***************************************/}
      <Grid templateAreas={['title close']} xcss={gridStyles}>
        <Flex xcss={titleContainerStyles} justifyContent="start" alignItems="center">
          <AutoAwesomeIcon className="context-menu-flash-icon" />
          <h2>Cardify.ai - Flashcards Generator</h2>
        </Flex>
      </Grid>

      {/************************************* ERROR MESSAGE WHEN SELECTED TEXT TOO LARGE **********************/}
      {showTimeoutWarning || showWarning ? (
        <Alert severity="warning" className='alert'>
          {showTimeoutWarning
            ? 'You have been timed out due to an internal error. Please verify that the AI backend is correctly installed according to the instructions in the repositorys README file, and then try again. (Development)'
            : 'You must select less than 1500 characters to use this feature. Please try again, or use our other feature "Content Byline" if you want to AI generate flashcards for the entire page.'
          }
        </Alert>

      ) : (
        <>

          {/************************************* ALL CARDS SAVED MESSAGE***************************************/}
          {generatedFlashcards.length === 0 && !loading && (
            <div className="success-message">
              You have saved all the AI-generated flashcards! Select other text to generate more AI flashcards!
            </div>
          )}

          {/************************************* AI GENERATED FLASHCARDS SECTION ***************************************/}
          {generatedFlashcards.length > 0 ? (
            <div className="card-wrapper">

              <ul className="card-list">
                {generatedFlashcards.map((flashcard, index) => (
                  <li key={index}>
                    <div className="card-link">
                      {/************************************* FLASHCARD FRONT FIELD ***************************************/}
                      <Field id={`flashcard-front-${index}`} name={`flashcard-front-${index}`} label="Flashcard Front">
                        {({ fieldProps }) => (
                          <Textfield
                            className="textfield"
                            {...fieldProps}
                            value={front[index] || ''}
                            onChange={(e) => {
                                const newFront = [...front];
                                newFront[index] = e.target.value;
                                setFront(newFront);
                            }}
                            placeholder="Type the front of the flashcard here..."
                          />
                        )}
                      </Field>

                      {/************************************* FLASHCARD BACK FIELD ***************************************/}
                      <Field id={`flashcard-back-${index}`} name={`flashcard-back-${index}`} label="Flashcard Back">
                        {({ fieldProps }) => (
                          <Textfield
                            className="textfield"
                            {...fieldProps}
                            value={back[index] || ''}
                            onChange={(e) => {
                                const newBack = [...back];
                                newBack[index] = e.target.value;
                                setBack(newBack);
                            }}
                            placeholder="Type the back of the flashcard here..."
                          />
                        )}
                      </Field>

                      {/************************************* HINT FIELD ***************************************/}
                      <Field id="flashcard-hint" name="flashcard-hint" label={
                        <div onClick={() => setShowHint(!showHint)} className="label-clickable">
                          <span>Hint (Optional)</span>
                          <span className="toggle-icon">
                            {showHint ? <ExpandLessIcon fontSize="small"/> : <ExpandMoreIcon fontSize="small" />}
                          </span>
                        </div>
                      }>
                        {({ fieldProps }) => (
                          <>
                            {showHint && (
                              <Textfield
                                {...fieldProps}
                                value={hint}
                                onChange={(e) => setHint(e.target.value)}
                                placeholder="Type a hint for the flashcard..."
                              />
                            )}
                          </>
                        )}
                      </Field>

                      {/************************************* LOCK/UNLOCKED FIELD ***************************************/}
                      <Field>
                        {() => (
                          <span onClick={() => setLocked(!locked)} style={{ cursor: 'pointer', justifyContent: 'flex-end', display: 'flex', alignItems: 'center' }}>
                            {locked ? 'This flashcard will be locked' : 'This flashcard will be unlocked'}
                            <span>
                              {locked ? (
                                <LockIcon label="Locked" />
                              ) : (
                                <UnlockIcon label="Unlocked" />
                              )}
                            </span>
                          </span>
                        )}
                      </Field>
                      {/***************************** SAVE FLASHCARD FIELD AND MESSAGE ****************************** */}
                      <div className="context-menu-button-group">


                        {saveSuccess && (
                        <Alert severity="success">New flashcard created successfully!</Alert>
                        )}
                        <Button appearance="primary" onClick={() => handleSaveFlashcard(flashcard, index)}>Save Flashcard</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            loading ? (
              <>
                <h4 className='deck-flashcard-amount'>Generating Flashcards with AI...</h4>
                <Box sx={{ width: '100%' }}>
                  <LinearProgress className='progress'/>
                </Box>
              </>
            ) : null
          )}
        </>
      )}
    </div>
  );
}


export default ContextMenuModule;
