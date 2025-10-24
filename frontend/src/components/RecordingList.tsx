import React, { useEffect, useState } from 'react';
import { getRecordings, deleteRecording, type Recording } from '../services/api';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Button, CircularProgress, Alert, Typography, IconButton, Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface RecordingListProps {
    listVersion: number;
    onPlayRecording: (filename: string) => void;
}

const RecordingList: React.FC<RecordingListProps> = ({ listVersion, onPlayRecording }) => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRecordings = async () => {
        try {
            setLoading(true);
            const data = await getRecordings();
            setRecordings(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch recordings.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecordings();
    }, [listVersion]);

    const handleDelete = async (id: number, filename: string) => {
        if (window.confirm(`Are you sure you want to delete recording "${filename}"?`)) {
            try {
                await deleteRecording(id);
                // Refresh the recordings list
                await fetchRecordings();
            } catch (err) {
                console.error('Failed to delete recording', err);
                alert('Failed to delete recording. See console for details.');
            }
        }
    };

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <>
            <Typography variant="h4" component="h2" gutterBottom sx={{ mt: 4 }}>
                Recordings
            </Typography>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Camera</TableCell>
                            <TableCell>Filename</TableCell>
                            <TableCell>Start Time</TableCell>
                            <TableCell>End Time</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {recordings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No recordings found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            recordings.map((rec) => (
                                <TableRow key={rec.id}>
                                    <TableCell>{rec.camera_name}</TableCell>
                                    <TableCell>{rec.filename}</TableCell>
                                    <TableCell>{new Date(rec.start_time).toLocaleString()}</TableCell>
                                    <TableCell>{new Date(rec.end_time).toLocaleString()}</TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Button variant="contained" onClick={() => onPlayRecording(rec.filename)}>
                                                Play
                                            </Button>
                                            <IconButton
                                                edge="end"
                                                aria-label="delete"
                                                onClick={() => handleDelete(rec.id, rec.filename)}
                                                color="error"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
};

export default RecordingList;
