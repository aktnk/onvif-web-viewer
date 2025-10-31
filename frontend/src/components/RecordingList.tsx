import React, { useEffect, useState } from 'react';
import { getRecordings, deleteRecording, type Recording } from '../services/api';
import {
    Box, Card, CardMedia, CardContent, CardActions,
    Button, CircularProgress, Alert, Typography, IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

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

    const BACKEND_URL = 'http://localhost:3001';

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h4" component="h2" gutterBottom>
                Recordings
            </Typography>
            {recordings.length === 0 ? (
                <Alert severity="info">No recordings found.</Alert>
            ) : (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 2,
                        mt: 2,
                    }}
                >
                    {recordings.map((rec) => (
                        <Card key={rec.id} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <CardMedia
                                component="img"
                                height="180"
                                image={
                                    rec.thumbnail
                                        ? `${BACKEND_URL}/thumbnails/${rec.thumbnail}`
                                        : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180"%3E%3Crect fill="%23ddd" width="320" height="180"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18"%3ENo Thumbnail%3C/text%3E%3C/svg%3E'
                                }
                                alt={rec.filename}
                                sx={{ objectFit: 'cover' }}
                            />
                            <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                <Typography variant="h6" component="div" noWrap title={rec.camera_name}>
                                    {rec.camera_name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap title={rec.filename}>
                                    {rec.filename}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Start: {new Date(rec.start_time).toLocaleString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    End: {new Date(rec.end_time).toLocaleString()}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<PlayArrowIcon />}
                                    onClick={() => onPlayRecording(rec.filename)}
                                >
                                    Play
                                </Button>
                                <IconButton
                                    size="small"
                                    aria-label="delete"
                                    onClick={() => handleDelete(rec.id, rec.filename)}
                                    color="error"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default RecordingList;
