import React, { useEffect, useState } from 'react';
import { getRecordings, type Recording } from '../services/api';
import { 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Paper, Button, CircularProgress, Alert, Typography 
} from '@mui/material';

interface RecordingListProps {
    listVersion: number;
    onPlayRecording: (filename: string) => void;
}

const RecordingList: React.FC<RecordingListProps> = ({ listVersion, onPlayRecording }) => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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

        fetchRecordings();
    }, [listVersion]);

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
                                        <Button variant="contained" onClick={() => onPlayRecording(rec.filename)}>
                                            Play
                                        </Button>
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
